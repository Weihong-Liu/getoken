import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, BookOpen, Check, Copy, Terminal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

type Step = {
  title: string;
  desc: string;
};

type CodeSample = {
  label: string;
  language: string;
  code: string;
};

type Section = {
  id: string;
  label: string;
  title: string;
  intro: string;
  steps: Step[];
  samples: CodeSample[];
  tips?: string[];
};

const sections: Section[] = [
  {
    id: "quick-start",
    label: "快速接入",
    title: "5 分钟跑通第一个请求",
    intro: "注册账号 → 充值 → 创建 API Key → 把 base_url 指到 GeToken,就可以直接复用现有 OpenAI/Claude SDK。",
    steps: [
      { title: "注册账号", desc: "邮箱注册即送 $1 额度,免充值即可联调全部模型。" },
      { title: "创建 API Key", desc: "进入「控制台 → API Keys」,点击新建,记下 sk-getoken- 开头的密钥。" },
      { title: "修改 base_url", desc: "把上游 base_url 替换为 https://api.getoken.cc,鉴权头保持不变。" },
      { title: "发起调用", desc: "选好 model 参数(见模型列表),按原生 SDK 用法直接请求即可。" },
    ],
    samples: [
      {
        label: "curl",
        language: "bash",
        code: `curl https://api.getoken.cc/v1/chat/completions \\
  -H "Authorization: Bearer sk-getoken-xxxxxxxx" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "gpt-5",
    "stream": true,
    "messages": [
      { "role": "user", "content": "你好 GeToken" }
    ]
  }'`,
      },
    ],
    tips: [
      "首次调用前请确保已充值或仍有赠送额度,否则会返回 402。",
      "所有请求都会出现在「调用日志」里,可按 trace_id 排查问题。",
    ],
  },
  {
    id: "openai",
    label: "OpenAI 兼容",
    title: "用 OpenAI SDK 调任意模型",
    intro: "兼容 OpenAI Chat Completions / Responses / Embeddings / Images 协议,只需替换 base_url 与 api_key。",
    steps: [
      { title: "安装 SDK", desc: "pip install openai 或 npm i openai,版本无要求,最新即可。" },
      { title: "替换初始化参数", desc: "把 base_url 改为 https://api.getoken.cc/v1,api_key 改为 GeToken 的 key。" },
      { title: "选择 model", desc: "支持 gpt-5 / claude-* / gemini-* / deepseek-* / qwen-* 等近百款模型,详见定价页。" },
    ],
    samples: [
      {
        label: "Python",
        language: "python",
        code: `from openai import OpenAI

client = OpenAI(
    base_url="https://api.getoken.cc/v1",
    api_key="sk-getoken-xxxxxxxx",
)

resp = client.chat.completions.create(
    model="claude-sonnet-4-6",
    messages=[{"role": "user", "content": "用一句话介绍 GeToken"}],
)
print(resp.choices[0].message.content)`,
      },
      {
        label: "Node.js",
        language: "javascript",
        code: `import OpenAI from "openai";

const client = new OpenAI({
  baseURL: "https://api.getoken.cc/v1",
  apiKey: process.env.GETOKEN_API_KEY,
});

const resp = await client.chat.completions.create({
  model: "gpt-5",
  stream: true,
  messages: [{ role: "user", content: "你好" }],
});

for await (const chunk of resp) {
  process.stdout.write(chunk.choices[0]?.delta?.content ?? "");
}`,
      },
    ],
  },
  {
    id: "claude",
    label: "Claude 兼容",
    title: "原生 Anthropic SDK 透传",
    intro: "保留 Anthropic 官方 SDK 的所有特性(tool use、thinking、prompt cache、batch),仅替换 base_url。",
    steps: [
      { title: "安装 SDK", desc: "pip install anthropic 或 npm i @anthropic-ai/sdk。" },
      { title: "替换 base_url", desc: "ANTHROPIC_BASE_URL=https://api.getoken.cc 即可,Header 用 GeToken 的 key。" },
      { title: "启用 prompt cache", desc: "在 system / messages 上加 cache_control 即可,缓存命中按官方折扣计价。" },
    ],
    samples: [
      {
        label: "Python",
        language: "python",
        code: `import anthropic

client = anthropic.Anthropic(
    base_url="https://api.getoken.cc",
    api_key="sk-getoken-xxxxxxxx",
)

msg = client.messages.create(
    model="claude-opus-4-7",
    max_tokens=1024,
    system=[
        {
            "type": "text",
            "text": "你是一个简洁的中文助手。",
            "cache_control": {"type": "ephemeral"},
        }
    ],
    messages=[{"role": "user", "content": "GeToken 有哪些上游?"}],
)
print(msg.content[0].text)`,
      },
    ],
    tips: ["Claude 透传 100% 字段对齐,无任何字段裁剪,适合企业场景。"],
  },
  {
    id: "billing",
    label: "充值与计费",
    title: "余额、倍率、邀请返利",
    intro: "GeToken 采用余额按量扣费 + 模型独立倍率,余额永久有效,不限调用次数。",
    steps: [
      { title: "查看倍率", desc: "在定价页或控制台「用量」中查看各模型最新的输入 / 输出单价。" },
      { title: "充值", desc: "进入「控制台 → 充值」,支持微信、支付宝、USDT,最低 $10 起。" },
      { title: "邀请返利", desc: "在「邀请」页生成专属链接,被邀请人消费的 5% 会自动返到你的余额。" },
      { title: "导出账单", desc: "「用量 → 导出 CSV」可拉取按日 / 按模型聚合的消费明细。" },
    ],
    samples: [
      {
        label: "查询余额",
        language: "bash",
        code: `curl https://api.getoken.cc/v1/account/balance \\
  -H "Authorization: Bearer sk-getoken-xxxxxxxx"

# {
#   "balance": "128.4300",
#   "currency": "CNY",
#   "usage_30d": "271.9200"
# }`,
      },
    ],
  },
  {
    id: "faq",
    label: "常见问题",
    title: "排查与限制",
    intro: "遇到错误码、超时、模型不可用等问题时,可以先按下面的清单排查。",
    steps: [
      { title: "401 / 403", desc: "Key 失效或权限不足。检查 Key 是否被禁用、是否填错前缀。" },
      { title: "402", desc: "余额不足。请前往充值,或确认是否所选模型倍率较高。" },
      { title: "429", desc: "并发或 RPM 超限。可在控制台升级配额,或对客户端做退避。" },
      { title: "5xx", desc: "上游故障。GeToken 会自动重试并切换通道,持续报错请联系工单。" },
    ],
    samples: [
      {
        label: "错误响应示例",
        language: "json",
        code: `{
  "error": {
    "type": "insufficient_quota",
    "code": 402,
    "message": "余额不足,请前往控制台充值",
    "trace_id": "trc_01HZ9X..."
  }
}`,
      },
    ],
    tips: ["每条响应 header 都会带 X-GeToken-Trace,提工单时附上可加速定位。"],
  },
];

function CodeBlock({ sample }: { sample: CodeSample }) {
  const [copied, setCopied] = useState(false);
  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(sample.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  };
  return (
    <div className="rounded-lg border bg-neutral-950 text-neutral-100 shadow-sm">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-2.5">
        <span className="inline-flex items-center gap-2 text-xs text-neutral-300">
          <Terminal className="size-3.5 text-green-300" />
          {sample.label}
        </span>
        <button
          type="button"
          onClick={onCopy}
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-neutral-300 hover:bg-white/10"
        >
          {copied ? <Check className="size-3.5 text-emerald-300" /> : <Copy className="size-3.5" />}
          {copied ? "已复制" : "复制"}
        </button>
      </div>
      <pre className="overflow-x-auto p-4 text-xs leading-7 text-neutral-200 md:p-5 md:text-sm">
        {sample.code}
      </pre>
    </div>
  );
}

export default function TutorialPage() {
  const [active, setActive] = useState(sections[0].id);
  const current = sections.find((s) => s.id === active) ?? sections[0];

  return (
    <>
      <section className="mx-auto max-w-6xl px-4 md:px-6 pt-16 pb-10 md:pt-24 md:pb-12">
        <div className="text-center">
          <p data-reveal className="text-sm text-primary font-medium">使用教程</p>
          <h1 data-reveal data-delay="100" className="mt-2 text-4xl md:text-5xl font-semibold">
            从注册到接入,
            <span className="text-muted-foreground">一页看完</span>
          </h1>
          <p data-reveal data-delay="200" className="mt-4 text-muted-foreground max-w-2xl mx-auto">
            兼容主流 SDK,只需替换 base_url 即可。下方按场景分类,选一个最贴近你需求的开始。
          </p>
          <div data-reveal data-delay="300" className="mt-6 flex justify-center gap-3">
            <Button asChild size="lg">
              <Link to="/register">
                免费注册 <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/pricing">查看模型价格</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 md:px-6 pb-24">
        <Tabs value={active} onValueChange={setActive}>
          <TabsList className="flex w-full flex-wrap gap-1 md:w-auto">
            {sections.map((s) => (
              <TabsTrigger key={s.id} value={s.id}>
                {s.label}
              </TabsTrigger>
            ))}
          </TabsList>

          {sections.map((s) => (
            <TabsContent key={s.id} value={s.id} className="mt-6">
              <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
                <Card data-reveal>
                  <CardHeader>
                    <div className="inline-flex w-fit items-center gap-2 rounded-md border bg-muted/50 px-2 py-1 text-xs text-muted-foreground">
                      <BookOpen className="size-3.5" />
                      {s.label}
                    </div>
                    <h2 className="mt-3 text-2xl font-semibold">{s.title}</h2>
                    <p className="mt-2 text-sm leading-7 text-muted-foreground">{s.intro}</p>
                  </CardHeader>
                  <CardContent>
                    <ol className="space-y-4">
                      {s.steps.map((step, i) => (
                        <li key={step.title} className="flex gap-3">
                          <span
                            className={cn(
                              "mt-0.5 grid size-6 shrink-0 place-items-center rounded-full border bg-background text-xs font-medium",
                              i === 0 && "border-primary text-primary",
                            )}
                          >
                            {i + 1}
                          </span>
                          <div>
                            <div className="text-sm font-medium">{step.title}</div>
                            <p className="mt-1 text-sm leading-6 text-muted-foreground">{step.desc}</p>
                          </div>
                        </li>
                      ))}
                    </ol>

                    {s.tips && s.tips.length > 0 && (
                      <div className="mt-6 rounded-md border border-primary/30 bg-primary/5 p-4">
                        <div className="text-xs font-medium text-primary">提示</div>
                        <ul className="mt-2 space-y-1.5">
                          {s.tips.map((tip) => (
                            <li key={tip} className="text-sm leading-6 text-muted-foreground">
                              · {tip}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <div data-reveal data-delay="100" className="space-y-4">
                  {current.samples.length > 1 ? (
                    <Tabs defaultValue={current.samples[0].label}>
                      <TabsList>
                        {current.samples.map((sample) => (
                          <TabsTrigger key={sample.label} value={sample.label}>
                            {sample.label}
                          </TabsTrigger>
                        ))}
                      </TabsList>
                      {current.samples.map((sample) => (
                        <TabsContent key={sample.label} value={sample.label} className="mt-4">
                          <CodeBlock sample={sample} />
                        </TabsContent>
                      ))}
                    </Tabs>
                  ) : (
                    <CodeBlock sample={current.samples[0]} />
                  )}

                  <Card className="bg-muted/40">
                    <CardContent className="flex items-center justify-between gap-4 py-5">
                      <div>
                        <div className="text-sm font-medium">需要更多帮助?</div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          完整文档与变更记录稍后上线,期间可通过工单与我们联系。
                        </p>
                      </div>
                      <Badge variant="secondary">敬请期待</Badge>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </section>
    </>
  );
}
