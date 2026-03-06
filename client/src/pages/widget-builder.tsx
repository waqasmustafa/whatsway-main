import { useState, useEffect, useMemo } from "react";
// import { useSite } from "@/contexts/SiteContext";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Copy,
  MessageSquare,
  Send,
  X,
  Minimize2,
  Phone,
  Search,
  ArrowLeft,
  Calendar,
  BookOpen,
  Users,
  Play,
  Mail,
  FileText,
  HelpCircle,
  ChevronRight,
  Clock,
  Sparkles,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import Header from "@/components/layout/header";
import { useTranslation } from "@/lib/i18n";
import { useAuth } from "@/contexts/auth-context";

interface TeamMember {
  id: string;
  name: string;
  avatar: string;
  role: string;
}

interface QuickAction {
  id: string;
  icon: string;
  label: string;
  url: string;
  description: string;
  enabled: boolean;
}

interface HelpCategory {
  id: string;
  icon: string;
  label: string;
  description: string;
}

export default function WidgetBuilder() {
  // const { selectedSiteId, sites } = useSite();
  const { user } = useAuth();
  const { toast } = useToast();
  const { t } = useTranslation();

  const { data: activeChannel } = useQuery({
    queryKey: ["/api/channels/active"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/channels/active");
      if (!response.ok) return null;
      return await response.json();
    },
  });

  console.log(activeChannel);

  const { data: brandSettings } = useQuery({
    queryKey: ["/api/brand-settings"],
    queryFn: () =>
      fetch("/api/brand-settings").then((res) => {
        if (!res.ok) throw new Error("Failed to fetch");
        return res.json();
      }),
  });

  const {
    data: site,
    isLoading,
    isSuccess,
    error,
  } = useQuery({
    queryKey: ["/api/active-site", activeChannel?.id],
    queryFn: async () => {
      const res = await apiRequest(
        "GET",
        `/api/active-site?channelId=${activeChannel?.id}`
      );
      if (!res.ok) throw new Error("Failed to fetch site");
      return res.json();
    },
    enabled: !!activeChannel?.id, // <-- IMPORTANT
  });

  console.log("site", site, "error", error);

  const selectedSiteId = site?.id;

  const [config, setConfig] = useState({
    // Basic Settings
    primaryColor: "#3b82f6",
    backgroundColor: "#ffffff",
    textColor: "#1f2937",
    accentColor: "#8b5cf6",
    position: "bottom-right",
    logoUrl: "", // Company logo for widget

    // Widget Content
    title: "Welcome!",
    subtitle: "How can we help?",
    greeting: "Hi! How can I help you today?",
    appName: brandSettings?.title, // For powered-by text

    tenantId: "814ce300-52c5-41d7-b103-a8e7bfa62a54",
    name: "My Site Name",
    domain: window.location.host,

    // Home Screen
    homeScreen: "messenger", // messenger, help, contact
    showSearch: true,
    showTeamAvatars: true,
    showQuickActions: true,
    showRecentArticles: true,

    // Messenger Layout
    messengerButtonText: "Send us a message",
    messengerSearchPlaceholder: "Search our Help Center",
    articlesCount: 3, // Number of articles to show

    // Help Center Layout
    helpSearchPlaceholder: "Search for answers...",
    helpCategoriesTitle: "Browse by category",
    helpCtaText: "Chat with us",
    helpCategories: [
      {
        id: "1",
        icon: "book-open",
        label: "Getting Started",
        description: "Learn the basics",
      },
      {
        id: "2",
        icon: "users",
        label: "Team Setup",
        description: "Manage your team",
      },
      {
        id: "3",
        icon: "file-text",
        label: "Billing",
        description: "Plans & payments",
      },
      {
        id: "4",
        icon: "help-circle",
        label: "FAQs",
        description: "Common questions",
      },
    ] as HelpCategory[],
    categoriesCount: 6, // Max categories to show

    // Contact Layout
    contactTitle: "How can we help?",
    contactCtaText: "Start a conversation",
    contactStatusMessage: "We typically reply within a few minutes",
    showContactStatus: true,

    // Team Settings
    teamMembers: [
      { id: "1", name: "Sarah", avatar: "", role: "Support" },
      { id: "2", name: "Mike", avatar: "", role: "Sales" },
      { id: "3", name: "Lisa", avatar: "", role: "Success" },
    ] as TeamMember[],
    responseTime: "A few minutes",

    // Quick Actions
    quickActions: [
      {
        id: "1",
        icon: "calendar",
        label: "Book a demo",
        url: "",
        description: "Schedule a personalized demo",
        enabled: true,
      },
      {
        id: "2",
        icon: "play",
        label: "Product tour",
        url: "",
        description: "See how it works",
        enabled: true,
      },
      {
        id: "3",
        icon: "book",
        label: "Documentation",
        url: "",
        description: "Browse our guides",
        enabled: true,
      },
      {
        id: "4",
        icon: "phone",
        label: "Schedule a call",
        url: "",
        description: "Talk to an expert",
        enabled: false,
      },
    ] as QuickAction[],

    // Features
    enableChat: true,
    enableVoiceCall: true,
    enableVideoCall: false,
    enableKnowledgeBase: true,
    enableEmailCapture: true,

    // Appearance
    widgetStyle: "modern", // modern, classic, minimal
    buttonSize: "large",
    roundedCorners: "lg",
    showPoweredBy: true,

    // Advanced Branding
    fontFamily: "system", // system, inter, roboto, open-sans
    buttonStyle: "solid", // solid, outline, gradient
    shadowIntensity: "medium", // none, light, medium, strong
    animationSpeed: "normal", // none, slow, normal, fast
    enableSoundEffects: false,
    aiTone: "friendly",
    aiMaxResponseLength: 200,
    aiFallbackMessage:
      "I'm sorry, I don't have the information you're looking for.",
    systemPrompt:
      "You are a helpful customer support assistant. Guidelines: - Be friendly and professional- Keep responses concise- If you don't know something, admit it- Direct users to human support for complex issues- Use the customer's name when provided",
  });

  const [isPreviewOpen, setIsPreviewOpen] = useState(true);
  const [previewScreen, setPreviewScreen] = useState<
    "home" | "chat" | "search" | "article"
  >("home");
  const [searchQuery, setSearchQuery] = useState("");
  const [chatMessages, setChatMessages] = useState([
    { role: "bot", text: config.greeting, time: "Just now" },
  ]);
  const [chatInput, setChatInput] = useState("");

  const {
    data: usersResponse,
    isLoading: usersLoading,
    error: usersError,
  } = useQuery({
    queryKey: ["/api/users"],
    queryFn: async () => {
      const response = await fetch("/api/users");
      if (!response.ok) throw new Error("Failed to fetch users");
      return response.json();
    },
  });

  // normalize users list
  const userList: Array<any> = useMemo(() => {
    if (!usersResponse) return [];
    // possible shapes: [] or { data: [] } or { users: [] }
    return usersResponse.data ?? usersResponse.users ?? usersResponse ?? [];
  }, [usersResponse]);

  // Fetch real KB articles for the site
  const { data: kbData } = useQuery({
    queryKey: ["/api/widget/kb", selectedSiteId],
    enabled: !!selectedSiteId,
  });

  // Get articles from KB data
  const sampleArticles =
    kbData?.categories?.flatMap((cat: any) =>
      cat.articles.map((article: any) => ({
        ...article,
        category: cat.name,
      }))
    ) || [];

  // Load widget config from current site
  // useEffect(() => {
  //   const currentSite = sites.find((s) => s.id === selectedSiteId);
  //   if (currentSite && currentSite.widgetConfig) {
  //     const savedConfig = currentSite.widgetConfig as any;
  //     if (Object.keys(savedConfig).length > 0) {
  //       setConfig((prevConfig) => ({ ...prevConfig, ...savedConfig }));
  //     }
  //   }
  // }, [selectedSiteId, sites]);

  // Save config mutation
  // const { data, isSuccess, isError } = useQuery({
  //   queryKey: ["siteConfig"],
  //   queryFn: async () => {
  //     const res = await apiRequest(
  //       "GET",
  //       `/api/active-site?channelId=${activeChannel?.id}`
  //     );
  //     return res.json();
  //   },
  // });
  // console.log("site", site);

  useEffect(() => {
    console.log(isSuccess, site);
    if (isSuccess && site?.widgetConfig) {
      setConfig((prev) => ({
        ...prev,
        ...site.widgetConfig, // merge everything from backend
        appName: brandSettings?.title || site.widgetConfig.appName,
        tenantId: site.id,
        name: site.name,
        domain: site.domain,
      }));
    }
  }, [isSuccess, site]);

  useEffect(() => {
    if (brandSettings?.title) {
      updateConfig("appName", brandSettings.title);
    }
  }, [brandSettings]);

  // console.log("setConfig" , config)

  const saveConfigMutation = useMutation({
    mutationFn: async (widgetConfig: typeof config) => {
      const res = await apiRequest("POST", `/api/sites/create_or_update`, {
        widgetConfig,
        channelId: activeChannel?.id,
        name: config.name,
        domain: !config.domain ? window.location.host : config.domain,
      });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/active-site", activeChannel?.id],
      });
      toast({
        title: "Configuration saved",
        description: "Your widget design has been saved successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to save widget configuration",
        variant: "destructive",
      });
    },
  });

  const updateConfig = (key: string, value: any) => {
    setConfig({ ...config, [key]: value });
  };

  const sendChatMessage = () => {
    if (!chatInput.trim()) return;
    setChatMessages([
      ...chatMessages,
      { role: "user", text: chatInput, time: "Just now" },
      {
        role: "bot",
        text: "Thanks for your message! A team member will respond shortly.",
        time: "Just now",
      },
    ]);
    setChatInput("");
  };

  const domain = site?.domain || window.location.origin;
  const widgetDomain = domain.startsWith("http") ? domain : `https://${domain}`;

  const widgetCode = `<!-- AI Chat Widget -->
    <script>
      window.aiChatConfig = {
       siteId: "${site?.id || "your-site-id"}",
        channelId:"${site?.channelId || "your-channel-id"}",
        url: "${widgetDomain}",
      };
    </script>
<script src="${widgetDomain}/widget/widget.js" async></script>`;

  const copyCode = () => {
    navigator.clipboard.writeText(widgetCode);
    toast({
      title: "Code copied",
      description: "Widget code copied to clipboard",
    });
  };

  return (
    <div className="flex-1 dots-bg min-h-screen">
      <Header title={t("widget.title")} subtitle={t("widget.subtitle")} />

      <main className="p-6 space-y-6">
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Customization Panel */}
          <div className="space-y-6">
            <Tabs
              defaultValue="content"
              className="space-y-7 flex flex-col gap-5 "
            >
              <TabsList className=" w-full flex flex-wrap items-center justify-start">
                <TabsTrigger value="content">Content</TabsTrigger>
                <TabsTrigger value="design">Design</TabsTrigger>
                <TabsTrigger value="layouts">Layouts</TabsTrigger>
                <TabsTrigger value="features">Features</TabsTrigger>
                <TabsTrigger value="team">Team</TabsTrigger>
                <TabsTrigger value="training">AI Training</TabsTrigger>
                <TabsTrigger value="advanced">Advanced</TabsTrigger>
              </TabsList>

              {/* Design Tab */}
              <TabsContent value="design" className="space-y-6  ">
                <Card>
                  <CardHeader>
                    <CardTitle>{t("widget.Design.Widget.title")}</CardTitle>
                    <CardDescription>
                      {t("widget.Design.Widget.subtitle")}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label>Style Preset</Label>
                      <RadioGroup
                        value={config.widgetStyle}
                        onValueChange={(value) =>
                          updateConfig("widgetStyle", value)
                        }
                      >
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="modern" id="modern" />
                          <Label htmlFor="modern" className="font-normal">
                            Modern (Gradient backgrounds)
                          </Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="classic" id="classic" />
                          <Label htmlFor="classic" className="font-normal">
                            Classic (Solid colors)
                          </Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="minimal" id="minimal" />
                          <Label htmlFor="minimal" className="font-normal">
                            Minimal (Clean & simple)
                          </Label>
                        </div>
                      </RadioGroup>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Primary Color</Label>
                        <div className="flex gap-2">
                          <Input
                            type="color"
                            value={config.primaryColor}
                            onChange={(e) =>
                              updateConfig("primaryColor", e.target.value)
                            }
                            className="w-16 h-10"
                          />
                          <Input
                            type="text"
                            value={config.primaryColor}
                            onChange={(e) =>
                              updateConfig("primaryColor", e.target.value)
                            }
                            className="flex-1 font-mono text-sm"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label>Accent Color</Label>
                        <div className="flex gap-2">
                          <Input
                            type="color"
                            value={config.accentColor}
                            onChange={(e) =>
                              updateConfig("accentColor", e.target.value)
                            }
                            className="w-16 h-10"
                          />
                          <Input
                            type="text"
                            value={config.accentColor}
                            onChange={(e) =>
                              updateConfig("accentColor", e.target.value)
                            }
                            className="flex-1 font-mono text-sm"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Company Logo URL</Label>
                      <Input
                        type="url"
                        value={config.logoUrl}
                        onChange={(e) =>
                          updateConfig("logoUrl", e.target.value)
                        }
                        placeholder="https://example.com/logo.png"
                      />
                      <p className="text-xs text-muted-foreground">
                        Enter the URL of your company logo
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label>Widget Position</Label>
                      <Select
                        value={config.position}
                        onValueChange={(value) =>
                          updateConfig("position", value)
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="bottom-right">
                            Bottom Right
                          </SelectItem>
                          <SelectItem value="bottom-left">
                            Bottom Left
                          </SelectItem>
                          <SelectItem value="top-right">Top Right</SelectItem>
                          <SelectItem value="top-left">Top Left</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>
                      {t("widget.Design.Home_Screen.title")}
                    </CardTitle>
                    <CardDescription>
                      {t("widget.Design.Home_Screen.subtitle")}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <RadioGroup
                      value={config.homeScreen}
                      onValueChange={(value) =>
                        updateConfig("homeScreen", value)
                      }
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="messenger" id="messenger" />
                        <Label htmlFor="messenger" className="font-normal">
                          Messenger (Chat-focused with team avatars)
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="help" id="help" />
                        <Label htmlFor="help" className="font-normal">
                          Help Center (Knowledge base first)
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="contact" id="contact" />
                        <Label htmlFor="contact" className="font-normal">
                          Contact (Quick actions & status)
                        </Label>
                      </div>
                    </RadioGroup>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Layouts Tab */}
              <TabsContent value="layouts" className="space-y-6">
                {/* Messenger Layout Settings */}
                {config.homeScreen === "messenger" && (
                  <>
                    <Card>
                      <CardHeader>
                        <CardTitle>
                          {t("widget.Layout.messenger_layout.title")}
                        </CardTitle>
                        <CardDescription>
                          {t("widget.Layout.messenger_layout.subtitle")}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="space-y-2">
                          <Label>Button Text</Label>
                          <Input
                            value={config.messengerButtonText}
                            onChange={(e) =>
                              updateConfig(
                                "messengerButtonText",
                                e.target.value
                              )
                            }
                            placeholder="Send us a message"
                            data-testid="input-messenger-button-text"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label>Search Placeholder</Label>
                          <Input
                            value={config.messengerSearchPlaceholder}
                            onChange={(e) =>
                              updateConfig(
                                "messengerSearchPlaceholder",
                                e.target.value
                              )
                            }
                            placeholder="Search our Help Center"
                            data-testid="input-messenger-search-placeholder"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label>Articles to Display</Label>
                          <Select
                            value={config.articlesCount.toString()}
                            onValueChange={(value) =>
                              updateConfig("articlesCount", parseInt(value))
                            }
                          >
                            <SelectTrigger data-testid="select-articles-count">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="2">2 articles</SelectItem>
                              <SelectItem value="3">3 articles</SelectItem>
                              <SelectItem value="4">4 articles</SelectItem>
                              <SelectItem value="5">5 articles</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="flex items-center justify-between">
                          <div className="space-y-0.5">
                            <Label>Show Team Avatars</Label>
                            <p className="text-sm text-muted-foreground">
                              Display team member photos
                            </p>
                          </div>
                          <Switch
                            checked={config.showTeamAvatars}
                            onCheckedChange={(checked) =>
                              updateConfig("showTeamAvatars", checked)
                            }
                            data-testid="switch-team-avatars"
                          />
                        </div>

                        <div className="flex items-center justify-between">
                          <div className="space-y-0.5">
                            <Label>Show Recent Articles</Label>
                            <p className="text-sm text-muted-foreground">
                              Display popular help articles
                            </p>
                          </div>
                          <Switch
                            checked={config.showRecentArticles}
                            onCheckedChange={(checked) =>
                              updateConfig("showRecentArticles", checked)
                            }
                            data-testid="switch-recent-articles"
                          />
                        </div>
                      </CardContent>
                    </Card>
                  </>
                )}

                {/* Help Center Layout Settings */}
                {config.homeScreen === "help" && (
                  <>
                    <Card>
                      <CardHeader>
                        <CardTitle>Help Center Layout</CardTitle>
                        <CardDescription>
                          Customize knowledge base-first layout
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="space-y-2">
                          <Label>Search Placeholder</Label>
                          <Input
                            value={config.helpSearchPlaceholder}
                            onChange={(e) =>
                              updateConfig(
                                "helpSearchPlaceholder",
                                e.target.value
                              )
                            }
                            placeholder="Search for answers..."
                            data-testid="input-help-search-placeholder"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label>Categories Title</Label>
                          <Input
                            value={config.helpCategoriesTitle}
                            onChange={(e) =>
                              updateConfig(
                                "helpCategoriesTitle",
                                e.target.value
                              )
                            }
                            placeholder="Browse by category"
                            data-testid="input-help-categories-title"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label>Chat Button Text</Label>
                          <Input
                            value={config.helpCtaText}
                            onChange={(e) =>
                              updateConfig("helpCtaText", e.target.value)
                            }
                            placeholder="Chat with us"
                            data-testid="input-help-cta-text"
                          />
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle>Help Categories</CardTitle>
                        <CardDescription>
                          Configure category shortcuts
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {config.helpCategories.map((category, index) => (
                          <div
                            key={category.id}
                            className="p-3 border rounded-lg space-y-3"
                          >
                            <div className="flex items-center justify-between">
                              <Label className="text-sm font-medium">
                                Category {index + 1}
                              </Label>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  const newCategories =
                                    config.helpCategories.filter(
                                      (_, i) => i !== index
                                    );
                                  updateConfig("helpCategories", newCategories);
                                }}
                                data-testid={`button-remove-category-${index}`}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                              <div className="space-y-2">
                                <Label className="text-xs">Icon</Label>
                                <Select
                                  value={category.icon}
                                  onValueChange={(value) => {
                                    const newCategories = [
                                      ...config.helpCategories,
                                    ];
                                    newCategories[index].icon = value;
                                    updateConfig(
                                      "helpCategories",
                                      newCategories
                                    );
                                  }}
                                >
                                  <SelectTrigger
                                    data-testid={`select-category-icon-${index}`}
                                  >
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="book-open">
                                      📖 Book
                                    </SelectItem>
                                    <SelectItem value="users">
                                      👥 Users
                                    </SelectItem>
                                    <SelectItem value="file-text">
                                      📄 Document
                                    </SelectItem>
                                    <SelectItem value="help-circle">
                                      ❓ Help
                                    </SelectItem>
                                    <SelectItem value="settings">
                                      ⚙️ Settings
                                    </SelectItem>
                                    <SelectItem value="shield">
                                      🛡️ Security
                                    </SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>

                              <div className="space-y-2">
                                <Label className="text-xs">Label</Label>
                                <Input
                                  value={category.label}
                                  onChange={(e) => {
                                    const newCategories = [
                                      ...config.helpCategories,
                                    ];
                                    newCategories[index].label = e.target.value;
                                    updateConfig(
                                      "helpCategories",
                                      newCategories
                                    );
                                  }}
                                  placeholder="Category name"
                                  data-testid={`input-category-label-${index}`}
                                />
                              </div>
                            </div>

                            <div className="space-y-2">
                              <Label className="text-xs">Description</Label>
                              <Input
                                value={category.description}
                                onChange={(e) => {
                                  const newCategories = [
                                    ...config.helpCategories,
                                  ];
                                  newCategories[index].description =
                                    e.target.value;
                                  updateConfig("helpCategories", newCategories);
                                }}
                                placeholder="Brief description"
                                data-testid={`input-category-description-${index}`}
                              />
                            </div>
                          </div>
                        ))}

                        <Button
                          variant="outline"
                          className="w-full"
                          onClick={() => {
                            const newCategories = [
                              ...config.helpCategories,
                              {
                                id: Date.now().toString(),
                                icon: "help-circle",
                                label: "New Category",
                                description: "Description",
                              },
                            ];
                            updateConfig("helpCategories", newCategories);
                          }}
                          data-testid="button-add-category"
                        >
                          Add Category
                        </Button>
                      </CardContent>
                    </Card>
                  </>
                )}

                {/* Contact Layout Settings */}
                {config.homeScreen === "contact" && (
                  <>
                    <Card>
                      <CardHeader>
                        <CardTitle>Contact Layout</CardTitle>
                        <CardDescription>
                          Customize quick actions layout
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="space-y-2">
                          <Label>Title</Label>
                          <Input
                            value={config.contactTitle}
                            onChange={(e) =>
                              updateConfig("contactTitle", e.target.value)
                            }
                            placeholder="How can we help?"
                            data-testid="input-contact-title"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label>Chat Button Text</Label>
                          <Input
                            value={config.contactCtaText}
                            onChange={(e) =>
                              updateConfig("contactCtaText", e.target.value)
                            }
                            placeholder="Start a conversation"
                            data-testid="input-contact-cta-text"
                          />
                        </div>

                        <div className="flex items-center justify-between">
                          <div className="space-y-0.5">
                            <Label>Show Status Message</Label>
                            <p className="text-sm text-muted-foreground">
                              Display response time
                            </p>
                          </div>
                          <Switch
                            checked={config.showContactStatus}
                            onCheckedChange={(checked) =>
                              updateConfig("showContactStatus", checked)
                            }
                            data-testid="switch-contact-status"
                          />
                        </div>

                        {config.showContactStatus && (
                          <div className="space-y-2">
                            <Label>Status Message</Label>
                            <Input
                              value={config.contactStatusMessage}
                              onChange={(e) =>
                                updateConfig(
                                  "contactStatusMessage",
                                  e.target.value
                                )
                              }
                              placeholder="We typically reply within a few minutes"
                              data-testid="input-contact-status-message"
                            />
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle>Quick Actions</CardTitle>
                        <CardDescription>
                          Configure action buttons
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {config.quickActions.map((action, index) => (
                          <div
                            key={action.id}
                            className="p-3 border rounded-lg space-y-3"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Switch
                                  checked={action.enabled}
                                  onCheckedChange={(checked) => {
                                    const newActions = [...config.quickActions];
                                    newActions[index].enabled = checked;
                                    updateConfig("quickActions", newActions);
                                  }}
                                  data-testid={`switch-action-${index}`}
                                />
                                <Label className="text-sm font-medium">
                                  Action {index + 1}
                                </Label>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  const newActions = config.quickActions.filter(
                                    (_, i) => i !== index
                                  );
                                  updateConfig("quickActions", newActions);
                                }}
                                data-testid={`button-remove-action-${index}`}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                              <div className="space-y-2">
                                <Label className="text-xs">Icon</Label>
                                <Select
                                  value={action.icon}
                                  onValueChange={(value) => {
                                    const newActions = [...config.quickActions];
                                    newActions[index].icon = value;
                                    updateConfig("quickActions", newActions);
                                  }}
                                >
                                  <SelectTrigger
                                    data-testid={`select-action-icon-${index}`}
                                  >
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="calendar">
                                      📅 Calendar
                                    </SelectItem>
                                    <SelectItem value="play">
                                      ▶️ Play
                                    </SelectItem>
                                    <SelectItem value="book">
                                      📚 Book
                                    </SelectItem>
                                    <SelectItem value="phone">
                                      📞 Phone
                                    </SelectItem>
                                    <SelectItem value="mail">
                                      ✉️ Mail
                                    </SelectItem>
                                    <SelectItem value="users">
                                      👥 Users
                                    </SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>

                              <div className="space-y-2">
                                <Label className="text-xs">Label</Label>
                                <Input
                                  value={action.label}
                                  onChange={(e) => {
                                    const newActions = [...config.quickActions];
                                    newActions[index].label = e.target.value;
                                    updateConfig("quickActions", newActions);
                                  }}
                                  placeholder="Action label"
                                  data-testid={`input-action-label-${index}`}
                                />
                              </div>
                            </div>

                            <div className="space-y-2">
                              <Label className="text-xs">Description</Label>
                              <Input
                                value={action.description}
                                onChange={(e) => {
                                  const newActions = [...config.quickActions];
                                  newActions[index].description =
                                    e.target.value;
                                  updateConfig("quickActions", newActions);
                                }}
                                placeholder="Brief description"
                                data-testid={`input-action-description-${index}`}
                              />
                            </div>

                            <div className="space-y-2">
                              <Label className="text-xs">URL (Optional)</Label>
                              <Input
                                value={action.url}
                                onChange={(e) => {
                                  const newActions = [...config.quickActions];
                                  newActions[index].url = e.target.value;
                                  updateConfig("quickActions", newActions);
                                }}
                                placeholder="https://example.com"
                                data-testid={`input-action-url-${index}`}
                              />
                            </div>
                          </div>
                        ))}

                        <Button
                          variant="outline"
                          className="w-full"
                          onClick={() => {
                            const newActions = [
                              ...config.quickActions,
                              {
                                id: Date.now().toString(),
                                icon: "help-circle",
                                label: "New Action",
                                url: "",
                                description: "Get started quickly",
                                enabled: true,
                              },
                            ];
                            updateConfig("quickActions", newActions);
                          }}
                          data-testid="button-add-action"
                        >
                          Add Quick Action
                        </Button>
                      </CardContent>
                    </Card>
                  </>
                )}
              </TabsContent>

              {/* Content Tab */}
              <TabsContent value="content" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>{t("widget.Content.messagetitle")}</CardTitle>
                    <CardDescription>
                      {t("widget.Content.messageSubtitle")}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label>Title</Label>
                      <Input
                        value={config.title}
                        onChange={(e) => updateConfig("title", e.target.value)}
                        placeholder="Welcome!"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Subtitle</Label>
                      <Input
                        value={config.subtitle}
                        onChange={(e) =>
                          updateConfig("subtitle", e.target.value)
                        }
                        placeholder="How can we help?"
                      />
                    </div>

                    {/* added two new fields (start) */}
                    <div className="space-y-2">
                      <Label>Name</Label>
                      <Input
                        value={config.name}
                        onChange={(e) => updateConfig("name", e.target.value)}
                        placeholder="Name"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Domain</Label>
                      <Input
                        value={config.domain}
                        onChange={(e) => updateConfig("domain", e.target.value)}
                        placeholder="www.example.com"
                      />
                    </div>

                    {/* added two new fields (end) */}

                    <div className="space-y-2">
                      <Label>Chat Greeting</Label>
                      <Textarea
                        value={config.greeting}
                        onChange={(e) =>
                          updateConfig("greeting", e.target.value)
                        }
                        rows={3}
                        placeholder="Hi! How can I help you today?"
                      />
                    </div>

                    {/* <div className="space-y-2">
                      <Label>App Name</Label>
                      <Input value={config.appName} readOnly />
                      <p className="text-xs text-muted-foreground">
                        Shows in "Powered by" text when enabled
                      </p>
                    </div> */}

                    <div className="space-y-2">
                      <Label>Response Time</Label>
                      <Select
                        value={config.responseTime}
                        onValueChange={(value) =>
                          updateConfig("responseTime", value)
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="A few minutes">
                            A few minutes
                          </SelectItem>
                          <SelectItem value="A few hours">
                            A few hours
                          </SelectItem>
                          <SelectItem value="Within a day">
                            Within a day
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Features Tab */}
              <TabsContent value="features" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>
                      {" "}
                      {t("widget.features.Widget_Features.title")}
                    </CardTitle>
                    <CardDescription>
                      {t("widget.features.Widget_Features.subtitle")}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>Live Chat</Label>
                        <p className="text-sm text-muted-foreground">
                          Enable real-time messaging
                        </p>
                      </div>
                      <Switch
                        checked={config.enableChat}
                        onCheckedChange={(checked) =>
                          updateConfig("enableChat", checked)
                        }
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>Knowledge Base</Label>
                        <p className="text-sm text-muted-foreground">
                          Show help articles
                        </p>
                      </div>
                      <Switch
                        checked={config.enableKnowledgeBase}
                        onCheckedChange={(checked) =>
                          updateConfig("enableKnowledgeBase", checked)
                        }
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>Quick Actions</Label>
                        <p className="text-sm text-muted-foreground">
                          Show action buttons
                        </p>
                      </div>
                      <Switch
                        checked={config.showQuickActions}
                        onCheckedChange={(checked) =>
                          updateConfig("showQuickActions", checked)
                        }
                      />
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Team Tab */}
              <TabsContent value="team" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>
                      {" "}
                      {t("widget.team.Widget_Features.title")}
                    </CardTitle>
                    <CardDescription>
                      {t("widget.team.Widget_Features.subtitle")}
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="space-y-4">
                    {config.teamMembers.map((member, index) => (
                      <div
                        key={member.id}
                        className="flex items-center gap-4 p-3 border rounded-lg"
                      >
                        {/* Avatar */}
                        <Avatar className="h-10 w-10">
                          {member.avatar ? (
                            <AvatarImage
                              src={member.avatar}
                              alt={member.name}
                            />
                          ) : (
                            <AvatarFallback>
                              {member.name?.[0] ?? "U"}
                            </AvatarFallback>
                          )}
                        </Avatar>

                        {/* Member Fields */}
                        <div className="flex-1 space-y-2">
                          {/* Select User Dropdown */}
                          <select
                            value={member.userId || ""}
                            onChange={(e) => {
                              const selectedId = e.target.value;
                              const selectedUser = userList.find(
                                (u) => u.id === selectedId
                              );

                              const newMembers = [...config.teamMembers];

                              if (selectedUser) {
                                newMembers[index] = {
                                  ...member,
                                  userId: selectedUser.id,
                                  name: `${selectedUser.firstName} ${selectedUser.lastName}`.trim(),
                                  role: selectedUser.role || "Support",
                                  avatar: selectedUser.avatar || "",
                                  email: selectedUser.email,
                                };
                              } else {
                                newMembers[index].userId = "";
                              }

                              updateConfig("teamMembers", newMembers);
                            }}
                            className="border rounded-md px-2 py-1 w-full"
                          >
                            <option value="">— Select a user —</option>
                            {usersLoading && <option>Loading users...</option>}
                            {userList.map((user) => (
                              <option key={user.id} value={user.id}>
                                {`${user.firstName} ${user.lastName}`} (
                                {user.email})
                              </option>
                            ))}
                          </select>

                          {/* Editable fields */}
                          <div className="grid grid-cols-2 gap-2">
                            <Input
                              value={member.name}
                              onChange={(e) => {
                                const newMembers = [...config.teamMembers];
                                newMembers[index].name = e.target.value;
                                updateConfig("teamMembers", newMembers);
                              }}
                              placeholder="Name"
                            />
                            <Input
                              value={member.role}
                              onChange={(e) => {
                                const newMembers = [...config.teamMembers];
                                newMembers[index].role = e.target.value;
                                updateConfig("teamMembers", newMembers);
                              }}
                              placeholder="Role"
                            />
                          </div>

                          <Input
                            type="url"
                            value={member.avatar}
                            onChange={(e) => {
                              const newMembers = [...config.teamMembers];
                              newMembers[index].avatar = e.target.value;
                              updateConfig("teamMembers", newMembers);
                            }}
                            placeholder="Profile photo URL (optional)"
                          />
                        </div>

                        {/* Remove Member */}
                        <Button
                          variant="ghost"
                          onClick={() => {
                            const newMembers = config.teamMembers.filter(
                              (_, i) => i !== index
                            );
                            updateConfig("teamMembers", newMembers);
                          }}
                        >
                          Remove
                        </Button>
                      </div>
                    ))}

                    {/* Add New Member */}
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => {
                        const newMembers = [
                          ...config.teamMembers,
                          {
                            id: Date.now().toString(),
                            name: "",
                            role: "Support",
                            avatar: "",
                            userId: "",
                          },
                        ];
                        updateConfig("teamMembers", newMembers);
                      }}
                    >
                      Add Team Member
                    </Button>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* AI Training Tab */}
              <TabsContent value="training" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>
                      {" "}
                      {t("widget.ai.Widget_Features.title")}
                    </CardTitle>
                    <CardDescription>
                      {t("widget.ai.Widget_Features.title")}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label>Response Tone</Label>
                      <Select
                        value={config?.aiTone}
                        onValueChange={(value) => updateConfig("aiTone", value)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="formal">Formal</SelectItem>
                          <SelectItem value="friendly">Friendly</SelectItem>
                          <SelectItem value="concise">Concise</SelectItem>
                          <SelectItem value="detailed">Detailed</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Max Response Length</Label>
                      <Select
                        value={config?.aiMaxResponseLength.toString()}
                        onValueChange={(value) =>
                          updateConfig("aiMaxResponseLength", parseInt(value))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="100">100 words</SelectItem>
                          <SelectItem value="200">200 words</SelectItem>
                          <SelectItem value="300">300 words</SelectItem>
                          <SelectItem value="500">500 words</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Fallback Message</Label>
                      <Textarea
                        value={config?.aiFallbackMessage}
                        onChange={(e) =>
                          updateConfig("aiFallbackMessage", e.target.value)
                        }
                        rows={3}
                        placeholder="I'm sorry, I don't have the information you're looking for."
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>System Prompt</Label>
                      <Textarea
                        value={config?.systemPrompt}
                        onChange={(e) =>
                          updateConfig("systemPrompt", e.target.value)
                        }
                        rows={3}
                        placeholder="You are a helpful customer support assistant."
                      />
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Advanced Tab */}
              <TabsContent value="advanced" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>
                      {" "}
                      {t("widget.advanced.Widget_Features.title")}
                    </CardTitle>
                    <CardDescription>
                      {t("widget.advanced.Widget_Features.title")}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label>Font Family</Label>
                      <Select
                        value={config.fontFamily}
                        onValueChange={(value) =>
                          updateConfig("fontFamily", value)
                        }
                      >
                        <SelectTrigger data-testid="select-font-family">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="system">System Default</SelectItem>
                          <SelectItem value="inter">Inter</SelectItem>
                          <SelectItem value="roboto">Roboto</SelectItem>
                          <SelectItem value="open-sans">Open Sans</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Button Style</Label>
                      <Select
                        value={config.buttonStyle}
                        onValueChange={(value) =>
                          updateConfig("buttonStyle", value)
                        }
                      >
                        <SelectTrigger data-testid="select-button-style">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="solid">Solid Fill</SelectItem>
                          <SelectItem value="outline">Outline</SelectItem>
                          <SelectItem value="gradient">Gradient</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Shadow Intensity</Label>
                      <Select
                        value={config.shadowIntensity}
                        onValueChange={(value) =>
                          updateConfig("shadowIntensity", value)
                        }
                      >
                        <SelectTrigger data-testid="select-shadow-intensity">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">None</SelectItem>
                          <SelectItem value="light">Light</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="strong">Strong</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Animation Speed</Label>
                      <Select
                        value={config.animationSpeed}
                        onValueChange={(value) =>
                          updateConfig("animationSpeed", value)
                        }
                      >
                        <SelectTrigger data-testid="select-animation-speed">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">None (Instant)</SelectItem>
                          <SelectItem value="slow">Slow</SelectItem>
                          <SelectItem value="normal">Normal</SelectItem>
                          <SelectItem value="fast">Fast</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>Sound Effects</Label>
                        <p className="text-sm text-muted-foreground">
                          Play sounds for interactions
                        </p>
                      </div>
                      <Switch
                        checked={config.enableSoundEffects}
                        onCheckedChange={(checked) =>
                          updateConfig("enableSoundEffects", checked)
                        }
                        data-testid="switch-sound-effects"
                      />
                    </div> */}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>

            <Card>
              <CardHeader>
                <CardTitle>{t("widget.Content.Installation.title")}</CardTitle>
                <CardDescription>
                  {t("widget.Content.Installation.subtitle")}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {site ? (
                  <div className="relative">
                    <pre className="bg-secondary p-4 rounded-lg overflow-x-auto text-xs">
                      <code className="font-mono">{widgetCode}</code>
                    </pre>
                    <Button
                      variant="outline"
                      size="sm"
                      className="absolute top-2 right-2"
                      onClick={copyCode}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="relative">Please make widget any site</div>
                )}

                <Button
                  onClick={() => saveConfigMutation.mutate(config)}
                  disabled={user?.username === "demouser" || saveConfigMutation.isPending}
                  className="w-full"
                >
                  {saveConfigMutation.isPending
                    ? "Saving..."
                    : "Save Configuration"}
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Live Preview Panel */}
          <div className="space-y-6">
            <Card className="sticky top-2">
              <CardHeader>
                <CardTitle> {t("widget.Content.Live_Preview.title")}</CardTitle>
                <CardDescription>
                  {" "}
                  {t("widget.Content.Live_Preview.subtitle")}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="relative h-[680px] bg-gradient-to-br from-slate-50 to-slate-100 rounded-lg border overflow-hidden">
                  {/* Background */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center space-y-2">
                      <p className="text-2xl font-bold text-slate-300">
                        Your Website
                      </p>
                      <p className="text-sm text-slate-400">Widget preview</p>
                    </div>
                  </div>

                  {/* Widget Container */}
                  {isPreviewOpen && (
                    <div
                      className={`absolute ${config.position.includes("right") ? "right-6" : "left-6"
                        } ${config.position.includes("top") ? "top-6" : "bottom-6"
                        } w-[380px] h-[600px] flex flex-col bg-white rounded-2xl shadow-2xl border overflow-hidden`}
                      style={{
                        borderRadius:
                          config.roundedCorners === "sm"
                            ? "0.5rem"
                            : config.roundedCorners === "lg"
                              ? "1rem"
                              : "1.5rem",
                      }}
                    >
                      {/* Widget Header */}
                      <div
                        className={`p-4 text-white ${config.widgetStyle === "modern"
                            ? "bg-gradient-to-r"
                            : "bg-solid"
                          }`}
                        style={{
                          background:
                            config.widgetStyle === "modern"
                              ? `linear-gradient(135deg, ${config.primaryColor}, ${config.accentColor})`
                              : config.primaryColor,
                        }}
                      >
                        <div className="flex items-center justify-between">
                          {previewScreen === "home" ? (
                            <>
                              <div className="flex items-center gap-3">
                                {config.logoUrl && (
                                  <img
                                    src={config.logoUrl}
                                    alt="Company Logo"
                                    className="h-10 w-10 object-contain rounded"
                                    onError={(e) => {
                                      (
                                        e.target as HTMLImageElement
                                      ).style.display = "none";
                                    }}
                                  />
                                )}
                                <div>
                                  <h3 className="text-lg font-semibold">
                                    {config.title}
                                  </h3>
                                  <p className="text-sm opacity-90">
                                    {config.subtitle}
                                  </p>
                                </div>
                              </div>
                              <button
                                onClick={() => setIsPreviewOpen(false)}
                                className="p-1 hover:bg-white/20 rounded"
                              >
                                <X className="h-5 w-5" />
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => setPreviewScreen("home")}
                                className="p-1 hover:bg-white/20 rounded"
                              >
                                <ArrowLeft className="h-5 w-5" />
                              </button>
                              <span className="font-medium">
                                {previewScreen === "chat"
                                  ? "Conversation"
                                  : previewScreen === "search"
                                    ? "Help Center"
                                    : "Article"}
                              </span>
                              <button
                                onClick={() => setIsPreviewOpen(false)}
                                className="p-1 hover:bg-white/20 rounded"
                              >
                                <X className="h-5 w-5" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Widget Content */}
                      <ScrollArea className="flex-1">
                        {previewScreen === "home" && (
                          <div className="p-4 space-y-4">
                            {/* Messenger Home Screen */}
                            {config.homeScreen === "messenger" && (
                              <>
                                {/* Start Conversation Card */}
                                <div className="bg-slate-50 rounded-xl p-4 space-y-3">
                                  <div className="flex items-center gap-3">
                                    <div className="flex -space-x-2">
                                      {config.teamMembers
                                        .slice(0, 3)
                                        .map((member) => (
                                          <Avatar
                                            key={member.id}
                                            className="h-10 w-10 border-2 border-white"
                                          >
                                            {member.avatar ? (
                                              <AvatarImage
                                                src={member.avatar}
                                                alt={member.name}
                                              />
                                            ) : null}
                                            <AvatarFallback
                                              style={{
                                                backgroundColor:
                                                  config.primaryColor,
                                                color: "white",
                                              }}
                                            >
                                              {member.name[0]}
                                            </AvatarFallback>
                                          </Avatar>
                                        ))}
                                    </div>
                                    <div className="flex-1">
                                      <p className="text-sm text-muted-foreground">
                                        Our usual reply time
                                      </p>
                                      <p className="text-sm font-medium flex items-center gap-1">
                                        <Clock className="h-3 w-3" />
                                        {config.responseTime}
                                      </p>
                                    </div>
                                  </div>
                                  <Button
                                    className="w-full"
                                    style={{
                                      backgroundColor: config.primaryColor,
                                    }}
                                    onClick={() => setPreviewScreen("chat")}
                                  >
                                    <MessageSquare className="h-4 w-4 mr-2" />
                                    {config.messengerButtonText}
                                  </Button>
                                </div>

                                {/* Search Help */}
                                {config.enableKnowledgeBase && (
                                  <div className="space-y-2">
                                    <p className="font-medium">
                                      Find an answer quickly
                                    </p>
                                    <div className="relative">
                                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                      <Input
                                        placeholder={
                                          config.messengerSearchPlaceholder
                                        }
                                        className="pl-10 pr-10"
                                        onClick={() =>
                                          setPreviewScreen("search")
                                        }
                                      />
                                      <ChevronRight className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    </div>
                                  </div>
                                )}

                                {/* Recent Articles */}
                                {config.showRecentArticles && (
                                  <div className="space-y-2">
                                    <p className="text-sm font-medium text-muted-foreground">
                                      Popular articles
                                    </p>
                                    <div className="space-y-1">
                                      {sampleArticles
                                        .slice(0, config.articlesCount)
                                        .map((article) => (
                                          <button
                                            key={article.id}
                                            className="w-full text-left p-2 hover:bg-slate-50 rounded-lg transition-colors"
                                            onClick={() =>
                                              setPreviewScreen("article")
                                            }
                                          >
                                            <p className="text-sm font-medium">
                                              {article.title}
                                            </p>
                                            <p className="text-xs text-muted-foreground">
                                              {article.category}
                                            </p>
                                          </button>
                                        ))}
                                    </div>
                                  </div>
                                )}
                              </>
                            )}

                            {/* Help Center Home Screen */}
                            {config.homeScreen === "help" && (
                              <>
                                {/* Search Bar */}
                                <div className="relative">
                                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                  <Input
                                    placeholder={config.helpSearchPlaceholder}
                                    className="pl-10"
                                    value={searchQuery}
                                    onChange={(e) =>
                                      setSearchQuery(e.target.value)
                                    }
                                  />
                                </div>

                                {/* Categories */}
                                <div className="space-y-2">
                                  <p className="font-medium">
                                    {config.helpCategoriesTitle}
                                  </p>
                                  <div className="grid grid-cols-2 gap-2">
                                    {config.helpCategories.map((category) => (
                                      <button
                                        key={category.id}
                                        className="p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors text-left"
                                      >
                                        {category.icon === "book-open" && (
                                          <BookOpen
                                            className="h-5 w-5 mb-1"
                                            style={{
                                              color: config.primaryColor,
                                            }}
                                          />
                                        )}
                                        {category.icon === "users" && (
                                          <Users
                                            className="h-5 w-5 mb-1"
                                            style={{
                                              color: config.primaryColor,
                                            }}
                                          />
                                        )}
                                        {category.icon === "file-text" && (
                                          <FileText
                                            className="h-5 w-5 mb-1"
                                            style={{
                                              color: config.primaryColor,
                                            }}
                                          />
                                        )}
                                        {category.icon === "help-circle" && (
                                          <HelpCircle
                                            className="h-5 w-5 mb-1"
                                            style={{
                                              color: config.primaryColor,
                                            }}
                                          />
                                        )}
                                        {category.icon === "settings" && (
                                          <FileText
                                            className="h-5 w-5 mb-1"
                                            style={{
                                              color: config.primaryColor,
                                            }}
                                          />
                                        )}
                                        {category.icon === "shield" && (
                                          <FileText
                                            className="h-5 w-5 mb-1"
                                            style={{
                                              color: config.primaryColor,
                                            }}
                                          />
                                        )}
                                        <p className="text-sm font-medium">
                                          {category.label}
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                          {category.description}
                                        </p>
                                      </button>
                                    ))}
                                  </div>
                                </div>

                                {/* Contact Option */}
                                <div className="border-t pt-4">
                                  <Button
                                    variant="outline"
                                    className="w-full"
                                    onClick={() => setPreviewScreen("chat")}
                                  >
                                    <MessageSquare className="h-4 w-4 mr-2" />
                                    {config.helpCtaText}
                                  </Button>
                                </div>
                              </>
                            )}

                            {/* Contact Home Screen */}
                            {config.homeScreen === "contact" && (
                              <>
                                {/* Title */}
                                <div className="space-y-1">
                                  <p className="font-medium">
                                    {config.contactTitle}
                                  </p>
                                  {config.showContactStatus && (
                                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                                      <Clock className="h-3 w-3" />
                                      {config.contactStatusMessage}
                                    </p>
                                  )}
                                </div>

                                {/* Quick Actions */}
                                {config.showQuickActions && (
                                  <div className="space-y-2">
                                    {config.quickActions
                                      .filter((a) => a.enabled)
                                      .map((action) => (
                                        <button
                                          key={action.id}
                                          className="w-full p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors flex items-center gap-3"
                                        >
                                          {action.icon === "calendar" && (
                                            <Calendar
                                              className="h-5 w-5"
                                              style={{
                                                color: config.primaryColor,
                                              }}
                                            />
                                          )}
                                          {action.icon === "play" && (
                                            <Play
                                              className="h-5 w-5"
                                              style={{
                                                color: config.primaryColor,
                                              }}
                                            />
                                          )}
                                          {action.icon === "book" && (
                                            <BookOpen
                                              className="h-5 w-5"
                                              style={{
                                                color: config.primaryColor,
                                              }}
                                            />
                                          )}
                                          {action.icon === "phone" && (
                                            <Phone
                                              className="h-5 w-5"
                                              style={{
                                                color: config.primaryColor,
                                              }}
                                            />
                                          )}
                                          {action.icon === "mail" && (
                                            <Mail
                                              className="h-5 w-5"
                                              style={{
                                                color: config.primaryColor,
                                              }}
                                            />
                                          )}
                                          {action.icon === "users" && (
                                            <Users
                                              className="h-5 w-5"
                                              style={{
                                                color: config.primaryColor,
                                              }}
                                            />
                                          )}
                                          <div className="text-left flex-1">
                                            <p className="text-sm font-medium">
                                              {action.label}
                                            </p>
                                            <p className="text-xs text-muted-foreground">
                                              {action.description}
                                            </p>
                                          </div>
                                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                        </button>
                                      ))}
                                  </div>
                                )}

                                {/* Start Conversation */}
                                {config.enableChat && (
                                  <Button
                                    className="w-full"
                                    style={{
                                      backgroundColor: config.primaryColor,
                                    }}
                                    onClick={() => setPreviewScreen("chat")}
                                  >
                                    <MessageSquare className="h-4 w-4 mr-2" />
                                    {config.contactCtaText}
                                  </Button>
                                )}
                              </>
                            )}
                          </div>
                        )}

                        {/* Chat Screen */}
                        {previewScreen === "chat" && (
                          <div className="flex flex-col h-[500px]">
                            <div className="flex-1 p-4 space-y-3">
                              {chatMessages.map((msg, i) => (
                                <div
                                  key={i}
                                  className={`flex gap-2 ${msg.role === "user"
                                      ? "justify-end"
                                      : "justify-start"
                                    }`}
                                >
                                  {msg.role === "bot" && (
                                    <Avatar className="h-8 w-8">
                                      <AvatarFallback
                                        style={{
                                          backgroundColor: config.primaryColor,
                                          color: "white",
                                        }}
                                      >
                                        AI
                                      </AvatarFallback>
                                    </Avatar>
                                  )}
                                  <div
                                    className={`rounded-xl px-3 py-2 max-w-[80%] ${msg.role === "user"
                                        ? "text-white"
                                        : "bg-slate-100"
                                      }`}
                                    style={
                                      msg.role === "user"
                                        ? {
                                          backgroundColor:
                                            config.primaryColor,
                                        }
                                        : {}
                                    }
                                  >
                                    <p className="text-sm">{msg.text}</p>
                                    <p className="text-xs opacity-70 mt-1">
                                      {msg.time}
                                    </p>
                                  </div>
                                </div>
                              ))}
                            </div>
                            <div className="p-4 border-t">
                              <div className="flex gap-2">
                                <Input
                                  placeholder="Type your message..."
                                  value={chatInput}
                                  onChange={(e) => setChatInput(e.target.value)}
                                  onKeyDown={(e) =>
                                    e.key === "Enter" && sendChatMessage()
                                  }
                                />
                                <Button
                                  size="icon"
                                  onClick={sendChatMessage}
                                  style={{
                                    backgroundColor: config.primaryColor,
                                  }}
                                >
                                  <Send className="h-4 w-4" />
                                </Button>
                                {/* {config.enableVoiceCall && (
                                  <Button size="icon" variant="outline">
                                    <Phone className="h-4 w-4" />
                                  </Button>
                                )} */}
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Search/Help Screen */}
                        {previewScreen === "search" && (
                          <div className="p-4 space-y-4">
                            <div className="relative">
                              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                              <Input
                                placeholder="Search for answers..."
                                className="pl-10"
                                autoFocus
                              />
                            </div>
                            <div className="space-y-2">
                              <p className="text-sm font-medium text-muted-foreground">
                                Popular articles
                              </p>
                              {sampleArticles.map((article) => (
                                <button
                                  key={article.id}
                                  className="w-full text-left p-3 border rounded-lg hover:bg-slate-50 transition-colors"
                                  onClick={() => setPreviewScreen("article")}
                                >
                                  <div className="flex items-start gap-3">
                                    <BookOpen
                                      className="h-4 w-4 mt-0.5"
                                      style={{ color: config.primaryColor }}
                                    />
                                    <div>
                                      <p className="font-medium text-sm">
                                        {article.title}
                                      </p>
                                      <p className="text-xs text-muted-foreground">
                                        {article.category}
                                      </p>
                                    </div>
                                  </div>
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Article View */}
                        {previewScreen === "article" && (
                          <div className="p-4 space-y-4">
                            <div className="space-y-2">
                              <h3 className="font-semibold">
                                Getting Started Guide
                              </h3>
                              <p className="text-sm text-muted-foreground">
                                Last updated 2 days ago
                              </p>
                            </div>
                            <div className="prose prose-sm">
                              <p>
                                Welcome to our platform! This guide will help
                                you get started quickly.
                              </p>
                              <h4 className="font-medium mt-3">
                                Step 1: Access your account
                              </h4>
                              <p className="text-sm text-muted-foreground">
                                Login with your email and verify your
                                account...
                              </p>
                              <h4 className="font-medium mt-3">
                                Step 2: Configure your settings
                              </h4>
                              <p className="text-sm text-muted-foreground">
                                Navigate to settings and customize your
                                preferences...
                              </p>
                            </div>
                            <div className="border-t pt-4 space-y-2">
                              <p className="text-sm font-medium">
                                Was this helpful?
                              </p>
                              <div className="flex gap-2">
                                <Button variant="outline" size="sm">
                                  👍 Yes
                                </Button>
                                <Button variant="outline" size="sm">
                                  👎 No
                                </Button>
                              </div>
                            </div>
                          </div>
                        )}
                      </ScrollArea>

                      {/* Powered By Footer */}
                      {config.showPoweredBy && previewScreen === "home" && (
                        <div className="p-3 border-t text-center">
                          <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                            <Sparkles className="h-3 w-3" />
                            Powered by {config.appName}
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Widget Button (when closed) */}
                  {!isPreviewOpen && (
                    <button
                      onClick={() => {
                        setIsPreviewOpen(true);
                        setPreviewScreen("home");
                      }}
                      className={`absolute ${config.position.includes("right") ? "right-6" : "left-6"
                        } ${config.position.includes("top") ? "top-6" : "bottom-6"
                        } p-4 rounded-full shadow-lg hover:scale-105 transition-transform`}
                      style={{ backgroundColor: config.primaryColor }}
                    >
                      <MessageSquare className="h-6 w-6 text-white" />
                    </button>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
