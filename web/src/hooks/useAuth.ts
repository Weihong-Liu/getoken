import useSWR from "swr";
import { apiFetch, setToken, type User } from "@/lib/api";

export function useAuth() {
  const { data, error, isLoading, mutate } = useSWR<User>(
    typeof window !== "undefined" && localStorage.getItem("getoken.session") ? "/user/self" : null,
    apiFetch,
    { revalidateOnFocus: false, shouldRetryOnError: false },
  );

  const logout = () => {
    setToken(null);
    mutate(undefined, { revalidate: false });
    window.location.href = "/login";
  };

  return {
    user: data,
    isLoading,
    error,
    isAuthed: Boolean(data),
    isAdmin: data?.role === "admin",
    refresh: mutate,
    logout,
  };
}
