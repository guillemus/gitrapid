import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Code, GitPullRequest, Github, Settings } from "lucide-react"

interface UnifiedHeaderProps {
  activeTab?: string
  type?: "repository" | "dashboard"
}

export function UnifiedHeader({ activeTab = "code", type = "repository" }: UnifiedHeaderProps) {
  const tabs = [
    { id: "code", label: "Code", icon: Code, href: "/" },
    { id: "issues", label: "Issues", icon: GitPullRequest, href: "/issues", count: 23 },
  ]

  return (
    <div className="border-b bg-background">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between pt-4 pb-0 font-normal">
          <div className="flex items-center space-x-2">
            {type === "repository" ? (
              <>
                <div className="w-8 h-8 bg-muted rounded-full flex items-center justify-center">
                  <Code className="w-4 h-4" />
                </div>
                <div className="flex items-center space-x-1">
                  <Link href="#" className="text-blue-600 hover:underline font-medium">
                    shadcn
                  </Link>
                  <span className="text-muted-foreground">/</span>
                  <Link href="#" className="text-blue-600 hover:underline font-bold">
                    ui
                  </Link>
                </div>
                <Badge variant="outline" className="ml-2">
                  Public
                </Badge>
              </>
            ) : (
              <>
                <Github className="w-8 h-8" />
                <span className="text-xl font-bold">GitHub Dashboard</span>
              </>
            )}
          </div>

          <div className="flex items-center space-x-4">
            <Link href="/dashboard" className="flex items-center space-x-2 text-muted-foreground hover:text-foreground">
              <Github className="w-5 h-5" />
              <span>Dashboard</span>
            </Link>
            <Link
              href="/dashboard/tokens"
              className="flex items-center space-x-2 text-muted-foreground hover:text-foreground"
            >
              <Settings className="w-5 h-5" />
              <span>Settings</span>
            </Link>
          </div>
        </div>

        {type === "repository" && (
          <div className="flex items-center space-x-6 overflow-x-auto pb-0">
            {tabs.map((tab) => (
              <Link
                key={tab.id}
                href={tab.href}
                className={`flex items-center space-x-2 px-1 text-sm font-medium whitespace-nowrap py-3 border-b-2 ${
                  activeTab === tab.id
                    ? "border-orange-500 text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground"
                }`}
              >
                <tab.icon className="w-4 h-4" />
                <span>{tab.label}</span>
                {tab.count && (
                  <Badge variant="secondary" className="ml-1 text-xs">
                    {tab.count}
                  </Badge>
                )}
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export { UnifiedHeader as RepositoryHeader }
