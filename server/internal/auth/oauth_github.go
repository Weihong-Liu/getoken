package auth

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"

	"github.com/puppet/getoken/server/internal/audit"
	"github.com/puppet/getoken/server/internal/middleware"
	"github.com/puppet/getoken/server/internal/pkg/errkit"
	"github.com/puppet/getoken/server/internal/pkg/idgen"
	"github.com/puppet/getoken/server/internal/response"
	"github.com/puppet/getoken/server/internal/store"
)

// GitHub OAuth (Login with GitHub).
//
// Flow:
//   1. SPA calls POST /api/auth/github/start → backend returns {url} and sets
//      a short-lived oauth_github_state cookie with a 32-byte random state.
//   2. SPA opens {url} in the same window; user grants permission on GitHub.
//   3. GitHub redirects to GITHUB_REDIRECT_URL?code=...&state=... .
//      The SPA forwards code+state to POST /api/auth/github/callback.
//   4. Backend verifies state cookie, exchanges code for token, fetches
//      /user + /user/emails, then upserts a User keyed by github_id or
//      verified primary email, and returns a JWT.
//
// Required env (see config.go):
//   GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, GITHUB_REDIRECT_URL
//
// The frontend's redirect URL must match the OAuth App's "Authorization
// callback URL" exactly, e.g. https://api.getoken.tech/auth/github/callback
// (handled inside the SPA, then forwarded to the backend POST endpoint).

const (
	githubAuthorizeURL = "https://github.com/login/oauth/authorize"
	githubTokenURL     = "https://github.com/login/oauth/access_token"
	githubUserURL      = "https://api.github.com/user"
	githubEmailsURL    = "https://api.github.com/user/emails"
	oauthStateCookie   = "oauth_github_state"
	oauthStateTTL      = 10 * time.Minute
	githubScopes       = "read:user user:email"
)

type githubCallbackReq struct {
	Code  string `json:"code" binding:"required"`
	State string `json:"state" binding:"required"`
}

type githubUserResp struct {
	ID    int64  `json:"id"`
	Login string `json:"login"`
	Email string `json:"email"`
}

type githubEmailItem struct {
	Email    string `json:"email"`
	Primary  bool   `json:"primary"`
	Verified bool   `json:"verified"`
}

func (h *Handler) githubStart(c *gin.Context) {
	if !h.cfg.GitHubOAuthEnabled() {
		response.Fail(c, errkit.New(503, "github_oauth_disabled", "GitHub OAuth 未配置"))
		return
	}
	stateBytes := make([]byte, 32)
	if _, err := rand.Read(stateBytes); err != nil {
		response.Fail(c, errkit.ErrInternal)
		return
	}
	state := base64.RawURLEncoding.EncodeToString(stateBytes)

	// HttpOnly + Secure + Lax for CSRF protection; SPA reads nothing.
	c.SetSameSite(http.SameSiteLaxMode)
	c.SetCookie(oauthStateCookie, state, int(oauthStateTTL.Seconds()), "/", "", true, true)

	q := url.Values{
		"client_id":    {h.cfg.GitHubClientID},
		"redirect_uri": {h.cfg.GitHubRedirectURL},
		"scope":        {githubScopes},
		"state":        {state},
	}
	response.OK(c, gin.H{"url": githubAuthorizeURL + "?" + q.Encode()})
}

func (h *Handler) githubCallback(c *gin.Context) {
	if !h.cfg.GitHubOAuthEnabled() {
		response.Fail(c, errkit.New(503, "github_oauth_disabled", "GitHub OAuth 未配置"))
		return
	}
	var req githubCallbackReq
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, errkit.BadRequest("missing code/state"))
		return
	}
	expected, err := c.Cookie(oauthStateCookie)
	if err != nil || expected == "" || expected != req.State {
		response.Fail(c, errkit.BadRequest("state 校验失败"))
		return
	}
	// Consume the cookie regardless of success below.
	c.SetSameSite(http.SameSiteLaxMode)
	c.SetCookie(oauthStateCookie, "", -1, "/", "", true, true)

	ctx, cancel := context.WithTimeout(c.Request.Context(), 15*time.Second)
	defer cancel()

	accessToken, err := h.exchangeGithubCode(ctx, req.Code)
	if err != nil {
		h.log.Warn("github code exchange failed", zap.Error(err))
		response.Fail(c, errkit.BadRequest("授权失败，请重试"))
		return
	}
	ghUser, primaryEmail, err := h.fetchGithubUser(ctx, accessToken)
	if err != nil {
		h.log.Warn("github user fetch failed", zap.Error(err))
		response.Fail(c, errkit.BadRequest("获取 GitHub 用户失败"))
		return
	}
	if ghUser.ID == 0 {
		response.Fail(c, errkit.BadRequest("GitHub 用户 ID 为空"))
		return
	}
	if primaryEmail == "" {
		response.Fail(c, errkit.BadRequest("GitHub 账户未公开可用 email，无法注册"))
		return
	}
	primaryEmail = strings.ToLower(strings.TrimSpace(primaryEmail))

	// 1. Try by github_id (returning existing GitHub-linked user)
	var u store.User
	if err := h.s.DB.Where("github_id = ?", ghUser.ID).First(&u).Error; err == nil {
		// found — fall through to issue JWT
	} else if err := h.s.DB.Where("email = ?", primaryEmail).First(&u).Error; err == nil {
		// 2. Existing email → link github_id
		ghID := ghUser.ID
		u.GithubID = &ghID
		if err := h.s.DB.Save(&u).Error; err != nil {
			h.log.Warn("github link existing user failed", zap.Error(err))
			response.Fail(c, errkit.ErrInternal)
			return
		}
	} else {
		// 3. Create new user
		if !h.cfg.RegisterEnabled {
			response.Fail(c, errkit.New(403, "registration_closed", "当前未开放注册"))
			return
		}
		username := strings.TrimSpace(ghUser.Login)
		if username == "" {
			username = strings.SplitN(primaryEmail, "@", 2)[0]
		}
		ghID := ghUser.ID
		u = store.User{
			Email:        primaryEmail,
			PasswordHash: "", // empty — OAuth-only user; /api/user/password updateable later
			Username:     username,
			Role:         "user",
			Status:       "active",
			GroupID:      1,
			InviteCode:   idgen.RandomAlpha(8),
			GithubID:     &ghID,
		}
		if err := h.s.DB.Create(&u).Error; err != nil {
			h.log.Warn("github create user failed", zap.Error(err))
			response.Fail(c, errkit.ErrInternal)
			return
		}
	}

	if u.Status == "banned" {
		response.Fail(c, errkit.Unauthorized("账号已被封禁"))
		return
	}

	token, _, _, err := middleware.IssueJWT(h.cfg, u.ID, u.Role)
	if err != nil {
		response.Fail(c, errkit.ErrInternal)
		return
	}
	audit.Emit(h.s.DB, h.log, audit.Event{
		ActorID: u.ID,
		Action:  "auth.login.github",
		Target:  fmt.Sprintf("user:%d", u.ID),
		Detail:  gin.H{"email": u.Email, "githubLogin": ghUser.Login},
		IP:      c.ClientIP(),
	})
	response.OK(c, gin.H{"token": token, "user": u})
}

func (h *Handler) exchangeGithubCode(ctx context.Context, code string) (string, error) {
	form := url.Values{
		"client_id":     {h.cfg.GitHubClientID},
		"client_secret": {h.cfg.GitHubClientSecret},
		"code":          {code},
		"redirect_uri":  {h.cfg.GitHubRedirectURL},
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, githubTokenURL, strings.NewReader(form.Encode()))
	if err != nil {
		return "", err
	}
	req.Header.Set("Accept", "application/json")
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("github token http %d: %s", resp.StatusCode, string(body))
	}
	var body struct {
		AccessToken string `json:"access_token"`
		TokenType   string `json:"token_type"`
		Scope       string `json:"scope"`
		Error       string `json:"error"`
		ErrorDesc   string `json:"error_description"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		return "", err
	}
	if body.AccessToken == "" {
		if body.Error != "" {
			return "", fmt.Errorf("github oauth error: %s — %s", body.Error, body.ErrorDesc)
		}
		return "", fmt.Errorf("no access_token in response")
	}
	return body.AccessToken, nil
}

func (h *Handler) fetchGithubUser(ctx context.Context, accessToken string) (*githubUserResp, string, error) {
	// 1. /user
	req, _ := http.NewRequestWithContext(ctx, http.MethodGet, githubUserURL, nil)
	req.Header.Set("Authorization", "Bearer "+accessToken)
	req.Header.Set("Accept", "application/vnd.github+json")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, "", err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, "", fmt.Errorf("github /user http %d: %s", resp.StatusCode, string(body))
	}
	var u githubUserResp
	if err := json.NewDecoder(resp.Body).Decode(&u); err != nil {
		return nil, "", err
	}

	// 2. /user/emails — pick primary verified
	req2, _ := http.NewRequestWithContext(ctx, http.MethodGet, githubEmailsURL, nil)
	req2.Header.Set("Authorization", "Bearer "+accessToken)
	req2.Header.Set("Accept", "application/vnd.github+json")
	if resp2, err := http.DefaultClient.Do(req2); err == nil {
		defer resp2.Body.Close()
		if resp2.StatusCode == http.StatusOK {
			var emails []githubEmailItem
			if json.NewDecoder(resp2.Body).Decode(&emails) == nil {
				for _, e := range emails {
					if e.Primary && e.Verified {
						return &u, e.Email, nil
					}
				}
			}
		}
	}
	// Fallback to /user email (may be empty if user hides it)
	return &u, u.Email, nil
}
