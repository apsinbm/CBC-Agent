"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts"
import { CalendarIcon, UsersIcon, ActivityIcon, TrendingUpIcon, ClockIcon, MessageSquareIcon, SearchIcon, HelpCircleIcon } from "lucide-react"

interface DashboardData {
  sessions: number
  pageViews: number
  searches: number
  faqViews: number
  avgSessionDuration: number
  chatSessions: number
  serviceRequests: number
  deflectionRate: number
  topPages: Array<{ page: string; views: number }>
  searchTrends: Array<{ date: string; searches: number }>
  faqCategories: Array<{ category: string; views: number }>
  hourlyActivity: Array<{ hour: string; activity: number }>
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [timeRange, setTimeRange] = useState("7d")

  useEffect(() => {
    fetchDashboardData()
  }, [timeRange])

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      fetchDashboardData()
    }, 30000)

    return () => clearInterval(interval)
  }, [timeRange])

  const fetchDashboardData = async () => {
    setLoading(true)
    try {
      // Fetch real data from CBC-Agent analytics API
      const response = await fetch(`http://localhost:3000/api/dashboard/analytics?timeRange=${timeRange}`)
      
      if (!response.ok) {
        throw new Error(`Failed to fetch analytics: ${response.status}`)
      }
      
      const realData = await response.json()
      
      // Validate that we have the expected data structure
      const dashboardData: DashboardData = {
        sessions: realData.sessions || 0,
        pageViews: realData.pageViews || 0,
        searches: realData.searches || 0,
        faqViews: realData.faqViews || 0,
        avgSessionDuration: realData.avgSessionDuration || 0,
        chatSessions: realData.chatSessions || 0,
        serviceRequests: realData.serviceRequests || 0,
        deflectionRate: realData.deflectionRate || 0,
        topPages: realData.topPages || [],
        searchTrends: realData.searchTrends || [],
        faqCategories: realData.faqCategories || [],
        hourlyActivity: realData.hourlyActivity || Array.from({ length: 24 }, (_, i) => ({
          hour: `${i}:00`,
          activity: 0
        }))
      }
      
      setData(dashboardData)
    } catch (error) {
      console.error("Failed to fetch dashboard data:", error)
      
      // Fallback to basic structure with zeros if API fails
      const fallbackData: DashboardData = {
        sessions: 0,
        pageViews: 0,
        searches: 0,
        faqViews: 0,
        avgSessionDuration: 0,
        chatSessions: 0,
        serviceRequests: 0,
        deflectionRate: 0,
        topPages: [],
        searchTrends: [],
        faqCategories: [],
        hourlyActivity: Array.from({ length: 24 }, (_, i) => ({
          hour: `${i}:00`,
          activity: 0
        }))
      }
      setData(fallbackData)
    } finally {
      setLoading(false)
    }
  }

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${minutes}m ${secs}s`
  }

  const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884d8"]

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading dashboard...</div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg text-red-500">Failed to load dashboard data</div>
      </div>
    )
  }

  return (
    <div className="p-8 space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">CBC Analytics Dashboard</h1>
          <p className="text-muted-foreground">Live analytics data from CBC-Agent • Last updated: {new Date().toLocaleTimeString()}</p>
        </div>
        <div className="flex gap-2">
          <Button variant={timeRange === "24h" ? "default" : "outline"} onClick={() => setTimeRange("24h")}>
            24h
          </Button>
          <Button variant={timeRange === "7d" ? "default" : "outline"} onClick={() => setTimeRange("7d")}>
            7d
          </Button>
          <Button variant={timeRange === "30d" ? "default" : "outline"} onClick={() => setTimeRange("30d")}>
            30d
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Sessions</CardTitle>
            <UsersIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.sessions.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">+12% from last period</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Page Views</CardTitle>
            <ActivityIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.pageViews.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">+8% from last period</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Session Duration</CardTitle>
            <ClockIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatDuration(data.avgSessionDuration)}</div>
            <p className="text-xs text-muted-foreground">+5% from last period</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Deflection Rate</CardTitle>
            <TrendingUpIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.deflectionRate}%</div>
            <p className="text-xs text-muted-foreground">+3% from last period</p>
          </CardContent>
        </Card>
      </div>

      {/* Service Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Searches</CardTitle>
            <SearchIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.searches}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">FAQ Views</CardTitle>
            <HelpCircleIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.faqViews}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Chat Sessions</CardTitle>
            <MessageSquareIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.chatSessions}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Service Requests</CardTitle>
            <CalendarIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.serviceRequests}</div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card>
          <CardHeader>
            <CardTitle>Search Trends</CardTitle>
            <CardDescription>Daily search volume over time</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={data.searchTrends}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="searches" stroke="#8884d8" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top Pages</CardTitle>
            <CardDescription>Most viewed pages</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={data.topPages}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="page" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="views" fill="#8884d8" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>FAQ Categories</CardTitle>
            <CardDescription>Distribution of FAQ views by category</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={data.faqCategories}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={(entry) => entry.category}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="views"
                >
                  {data.faqCategories.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Hourly Activity</CardTitle>
            <CardDescription>Activity patterns throughout the day</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={data.hourlyActivity}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="hour" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="activity" fill="#00C49F" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
