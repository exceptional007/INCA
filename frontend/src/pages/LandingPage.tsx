import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle2, LayoutDashboard, Clock, Users, ShieldCheck, ChevronRight } from 'lucide-react';

export const LandingPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Navigation */}
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50 w-full">
        <div className="container mx-auto flex h-16 items-center justify-between px-4 md:px-6">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <span className="font-bold text-lg tracking-tight">INCA</span>
          </div>
          <nav className="hidden md:flex gap-6">
            <a href="#features" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Features</a>
            <a href="#solutions" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Solutions</a>
            <a href="#about" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">About</a>
          </nav>
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => navigate('/login')}>Sign In</Button>
            <Button onClick={() => navigate('/login')}>Get Started</Button>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero Section */}
        <section className="w-full py-24 md:py-32 lg:py-48 border-b">
          <div className="container px-4 md:px-6 mx-auto">
            <div className="flex flex-col items-center space-y-8 text-center max-w-3xl mx-auto">
              <div className="space-y-4">
                <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl md:text-6xl lg:text-7xl">
                  Intelligent Campus <br />
                  <span className="text-muted-foreground">Automation</span>
                </h1>
                <p className="mx-auto max-w-[700px] text-lg text-muted-foreground md:text-xl">
                  Streamline academic scheduling, automate attendance tracking, and unify campus operations with our enterprise-grade SaaS platform.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
                <Button size="lg" className="w-full sm:w-auto group" onClick={() => navigate('/login')}>
                  Access Platform
                  <ChevronRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </Button>
                <Button variant="outline" size="lg" className="w-full sm:w-auto">
                  View Documentation
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="w-full py-20 md:py-32 bg-muted/30">
          <div className="container px-4 md:px-6 mx-auto">
            <div className="flex flex-col items-center justify-center space-y-4 text-center mb-12">
              <h2 className="text-3xl font-bold tracking-tight md:text-4xl">Platform Capabilities</h2>
              <p className="max-w-[700px] text-muted-foreground md:text-lg">
                Built for scale, security, and simplicity. Discover how INCA transforms institutional workflows.
              </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <Card className="bg-background">
                <CardHeader>
                  <LayoutDashboard className="h-10 w-10 mb-4 text-primary" />
                  <CardTitle>Unified Dashboard</CardTitle>
                  <CardDescription>
                    Role-based interfaces tailored for Super Admins, Faculty, Coordinators, and Students.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li className="flex items-center"><CheckCircle2 className="mr-2 h-4 w-4 text-primary" /> Custom metrics & insights</li>
                    <li className="flex items-center"><CheckCircle2 className="mr-2 h-4 w-4 text-primary" /> Quick action shortcuts</li>
                    <li className="flex items-center"><CheckCircle2 className="mr-2 h-4 w-4 text-primary" /> Real-time alerts</li>
                  </ul>
                </CardContent>
              </Card>

              <Card className="bg-background">
                <CardHeader>
                  <Clock className="h-10 w-10 mb-4 text-primary" />
                  <CardTitle>Smart Scheduling</CardTitle>
                  <CardDescription>
                    Conflict-free timetable generation and dynamic schedule adjustments.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li className="flex items-center"><CheckCircle2 className="mr-2 h-4 w-4 text-primary" /> Exception handling</li>
                    <li className="flex items-center"><CheckCircle2 className="mr-2 h-4 w-4 text-primary" /> Automated rescheduling</li>
                    <li className="flex items-center"><CheckCircle2 className="mr-2 h-4 w-4 text-primary" /> Faculty load balancing</li>
                  </ul>
                </CardContent>
              </Card>

              <Card className="bg-background">
                <CardHeader>
                  <Users className="h-10 w-10 mb-4 text-primary" />
                  <CardTitle>Attendance Tracking</CardTitle>
                  <CardDescription>
                    Seamless session attendance with robust audit trails and automated alerts.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li className="flex items-center"><CheckCircle2 className="mr-2 h-4 w-4 text-primary" /> 24-hour edit windows</li>
                    <li className="flex items-center"><CheckCircle2 className="mr-2 h-4 w-4 text-primary" /> Shortfall notifications</li>
                    <li className="flex items-center"><CheckCircle2 className="mr-2 h-4 w-4 text-primary" /> Institutional reporting</li>
                  </ul>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t py-12 md:py-16">
        <div className="container px-4 md:px-6 mx-auto grid grid-cols-2 md:grid-cols-4 gap-8">
          <div className="col-span-2 md:col-span-1 space-y-4">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5" />
              <span className="font-bold">INCA</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Intelligent Campus Assistant
            </p>
          </div>
          <div>
            <h3 className="font-semibold mb-4 text-sm">Product</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><a href="#" className="hover:text-foreground">Features</a></li>
              <li><a href="#" className="hover:text-foreground">Security</a></li>
              <li><a href="#" className="hover:text-foreground">Pricing</a></li>
            </ul>
          </div>
          <div>
            <h3 className="font-semibold mb-4 text-sm">Company</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><a href="#" className="hover:text-foreground">About</a></li>
              <li><a href="#" className="hover:text-foreground">Contact</a></li>
              <li><a href="#" className="hover:text-foreground">Careers</a></li>
            </ul>
          </div>
          <div>
            <h3 className="font-semibold mb-4 text-sm">Legal</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><a href="#" className="hover:text-foreground">Privacy Policy</a></li>
              <li><a href="#" className="hover:text-foreground">Terms of Service</a></li>
            </ul>
          </div>
        </div>
        <div className="container mx-auto mt-12 pt-8 border-t text-center text-sm text-muted-foreground">
          &copy; {new Date().getFullYear()} INCA Platform. All rights reserved.
        </div>
      </footer>
    </div>
  );
};
