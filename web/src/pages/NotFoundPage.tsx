import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

export default function NotFoundPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 text-center">
      <p className="text-sm font-medium text-primary">404</p>
      <h1 className="mt-3 text-3xl md:text-4xl font-semibold">页面不见啦</h1>
      <p className="mt-2 text-sm text-muted-foreground max-w-md">
        你访问的页面已被搬走或暂时找不到。可以返回首页或前往控制台继续浏览。
      </p>
      <div className="mt-6 flex gap-2">
        <Button asChild variant="outline"><Link to="/">返回首页</Link></Button>
        <Button asChild><Link to="/dashboard">前往控制台</Link></Button>
      </div>
    </div>
  );
}
