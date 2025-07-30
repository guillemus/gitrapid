import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useLogout } from './convex'
import { Button } from '@/components/ui/button'

export function DashboardPage() {
    const logout = useLogout()

    return (
        <div className="p-6">
            <div className="mb-6 flex items-center justify-between">
                <h1 className="text-2xl font-bold">Dashboard</h1>
                <Button onClick={logout}>Logout</Button>
            </div>
            <Card>
                <CardHeader>
                    <CardTitle>Welcome to GitRapid</CardTitle>
                    <CardDescription>
                        Your alternative GitHub UI for faster repository management
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <p>This is your dashboard page. More features coming soon!</p>
                </CardContent>
            </Card>
        </div>
    )
}
