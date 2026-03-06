import { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "wouter";
import {
  MessageCircle,
  Menu,
  X,
  ArrowRight,
  ChevronDown,
  Users,
  Briefcase,
  Mail,
  Zap,
  BookOpen,
  Calculator,
  FileText,
  Code,
  TrendingUp,
  LogOut,
  User,
  Settings,
  MessageSquare,
} from "lucide-react";
import LoadingAnimation from "./LoadingAnimation";
import { useAuth } from "@/contexts/auth-context";
import useStaticData from "@/hooks/useStaticData";
import { useTranslation } from "@/lib/i18n";
import { LanguageSelector } from "./language-selector";
import { AppSettings } from "@/types/types";
import { useQuery } from "@tanstack/react-query";

const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [showAboutMega, setShowAboutMega] = useState(false);
  const [showResourcesMega, setShowResourcesMega] = useState(false);
  const [showAboutMobile, setShowAboutMobile] = useState(false);
  const [showResourcesMobile, setShowResourcesMobile] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [getStartedLoading, setGetStartedLoading] = useState(false);
  const [location, setLocation] = useLocation();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { isAuthenticated, user, logout } = useAuth();

  const staticData = useStaticData();
  const { t } = useTranslation();

  const username = (user?.firstName || "") + " " + (user?.lastName || "");

  const logos = user?.avatar;

  const { data: brandSettings } = useQuery<AppSettings>({
    queryKey: ["/api/brand-settings"],
    queryFn: () => fetch("/api/brand-settings").then((res) => res.json()),
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    setIsMenuOpen(false);
    setShowAboutMobile(false);
    setShowResourcesMobile(false);
    closeMegaMenus();
  }, [location]);

  const handleLogin = () => {
    setLoginLoading(true);
    setTimeout(() => {
      setLoginLoading(false);
    }, 2000);
  };

  const handleGetStarted = () => {
    setGetStartedLoading(true);
    setTimeout(() => {
      setGetStartedLoading(false);
    }, 2000);
  };

  const closeMegaMenus = () => {
    setShowAboutMega(false);
    setShowResourcesMega(false);
  };

  const handleMenuToggle = () => {
    setIsMenuOpen(!isMenuOpen);
    if (isMenuOpen) {
      setShowAboutMobile(false);
      setShowResourcesMobile(false);
    }
  };

  const MegaMenu = ({
    items,
    isVisible,
  }: {
    items: typeof staticData.header.aboutMenuItems;
    isVisible: boolean;
    title: string;
  }) => (
    <div
      className={`fixed left-0 right-0 w-screen bg-white dark:bg-gray-900 shadow-2xl border-t border-gray-100 dark:border-gray-800 z-50 transition-all duration-300 ease-out max-h-[80vh] overflow-y-auto ${isVisible
          ? "opacity-100 translate-y-0 visible"
          : "opacity-0 -translate-y-4 invisible pointer-events-none"
        }`}
      style={{
        top: "56px",
      }}
    >
      <div className="max-w-7xl mx-auto p-4 sm:p-6 md:p-8">
        <div
          className={`grid gap-3 sm:gap-4 md:gap-6 ${items.length === 4
              ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4"
              : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
            }`}
        >
          {items.map((item, index) => (
            <Link
              key={`${item.title}-${index}`}
              href={item.path}
              className="group bg-gray-50 dark:bg-gray-800 rounded-xl p-4 sm:p-5 md:p-6 hover:bg-white dark:hover:bg-gray-700 hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1"
              onClick={closeMegaMenus}
            >
              <div className="relative overflow-hidden rounded-lg mb-3 sm:mb-4">
                <img
                  src={item.image}
                  alt={item.title}
                  className="w-full h-24 sm:h-28 md:h-32 object-cover transition-transform duration-300 group-hover:scale-105"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent"></div>
                <div className="absolute bottom-2 right-2 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm p-1.5 sm:p-2 rounded-lg">
                  <item.icon className="w-3 h-3 sm:w-4 sm:h-4 text-green-600" />
                </div>
              </div>

              <h3 className="font-bold text-gray-900 dark:text-white mb-1 sm:mb-2 group-hover:text-green-600 transition-colors text-sm sm:text-base">
                {item.title}
              </h3>
              <p className="text-gray-600 dark:text-gray-400 text-xs sm:text-sm leading-relaxed line-clamp-2">
                {item.description}
              </p>

              <div className="flex items-center mt-2 sm:mt-3 text-green-600 opacity-0 group-hover:opacity-100 transition-opacity">
                <span className="text-xs sm:text-sm font-medium">
                  {t("Landing.header.Learn")}
                </span>
                <ArrowRight className="w-3 h-3 sm:w-4 sm:h-4 ml-1 transform group-hover:translate-x-1 transition-transform" />
              </div>
            </Link>
          ))}
        </div>

        <div className="mt-6 sm:mt-8 pt-6 sm:pt-8 border-t border-gray-200 dark:border-gray-700 hidden md:block">
          <div className="bg-gradient-to-r from-green-50 to-blue-50 dark:from-green-900/20 dark:to-blue-900/20 rounded-xl p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white mb-1 sm:mb-2">
                  {t("Landing.header.redystart")}
                </h3>
                <p className="text-gray-600 dark:text-gray-400 text-sm sm:text-base">
                  {t("Landing.header.join")}
                </p>
              </div>
              <Link
                href="/login"
                className="bg-green-500 text-white px-4 sm:px-6 py-2 sm:py-3 rounded-lg hover:bg-green-600 transition-colors flex items-center group text-sm sm:text-base whitespace-nowrap"
                onClick={closeMegaMenus}
              >
                {t("Landing.header.Navlinks.3")}
                <ArrowRight className="w-3 h-3 sm:w-4 sm:h-4 ml-2 group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <header
        className={`fixed top-0 left-0 right-0 z-40 transition-all duration-300 ${isScrolled
            ? "bg-white/95 dark:bg-gray-900/95 backdrop-blur-lg shadow-lg"
            : "bg-white dark:bg-gray-900"
          }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20 sm:h-16">
            {/* Logo */}
            <Link href="/" className="flex items-center space-x-2 sm:space-x-3">
              {brandSettings?.logo ? (
                <img
                  src={brandSettings?.logo}
                  alt="Logo"
                  className="h-12  object-contain"
                />
              ) : (
                <div className="bg-green-800 text-primary-foreground rounded-full p-3">
                  <MessageSquare className="h-8 w-8" />
                </div>
              )}
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden lg:flex items-center space-x-6 xl:space-x-8">
              <Link
                href="/"
                className={`text-gray-700 dark:text-gray-300 hover:text-green-600 dark:hover:text-green-500 transition-colors font-medium text-sm xl:text-base ${location === "/" ? "text-green-600 dark:text-green-500" : ""
                  }`}
              >
                {t("Landing.header.Navlinks.0")}
              </Link>

              {/* About Mega Menu */}
              <div
                className="relative group"
                onMouseEnter={() => setShowAboutMega(true)}
                onMouseLeave={() => setShowAboutMega(false)}
              >
                <button
                  className="flex items-center text-gray-700 dark:text-gray-300 hover:text-green-600 dark:hover:text-green-500 transition-colors font-medium cursor-pointer bg-transparent border-none text-sm xl:text-base"
                  aria-haspopup="true"
                  aria-expanded={showAboutMega}
                  type="button"
                >
                  {t("Landing.header.Navlinks.1")}
                  <ChevronDown
                    className={`w-4 h-4 ml-1 transition-transform duration-200 ${showAboutMega ? "rotate-180" : ""
                      }`}
                  />
                </button>

                <div
                  className="absolute left-0 right-0 h-4 top-full"
                  style={{ top: "100%" }}
                />

                <MegaMenu
                  items={staticData.header.aboutMenuItems}
                  isVisible={showAboutMega}
                  title="Company"
                />
              </div>

              {/* Resources Mega Menu */}
              <div
                className="relative group"
                onMouseEnter={() => setShowResourcesMega(true)}
                onMouseLeave={() => setShowResourcesMega(false)}
              >
                <button
                  className="flex items-center text-gray-700 dark:text-gray-300 hover:text-green-600 dark:hover:text-green-500 transition-colors font-medium cursor-pointer bg-transparent border-none text-sm xl:text-base"
                  aria-haspopup="true"
                  aria-expanded={showResourcesMega}
                  type="button"
                >
                  {t("Landing.header.Navlinks.2")}
                  <ChevronDown
                    className={`w-4 h-4 ml-1 transition-transform duration-200 ${showResourcesMega ? "rotate-180" : ""
                      }`}
                  />
                </button>

                <div
                  className="absolute left-0 right-0 h-4 top-full"
                  style={{ top: "100%" }}
                />

                <MegaMenu
                  items={staticData.header.resourcesMenuItems}
                  isVisible={showResourcesMega}
                  title="Resources"
                />
              </div>
              <LanguageSelector />

              {!isAuthenticated && (
                <>
                  <Link
                    href="/login"
                    className="text-gray-700 dark:text-gray-300 hover:text-green-600 dark:hover:text-green-500 transition-colors font-medium"
                  >
                    {t("Landing.header.Navlinks.3")}
                  </Link>
                  <Link
                    href="/login"
                    className="bg-gradient-to-r from-green-500 to-green-600 text-white px-4 py-2 rounded-lg hover:from-green-600 hover:to-green-700 transition-all transform hover:scale-105 shadow-lg flex items-center group text-sm"
                  >
                    {t("Landing.header.Navlinks.3")}
                    <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                  </Link>
                </>
              )}

              {isAuthenticated && (
                <>
                  <Link
                    href="/dashboard"
                    className="text-gray-700 dark:text-gray-300 hover:text-green-600 dark:hover:text-green-500 transition-colors font-medium"
                  >
                    {t("Landing.header.dash")}
                  </Link>
                  <div className="relative" ref={dropdownRef}>
                    <button
                      className="w-10 h-10 rounded-full overflow-hidden border-2 border-gray-200 hover:border-gray-400 transition-colors"
                      onClick={() => setDropdownOpen(!dropdownOpen)}
                    >
                      <img
                        src={`https://ui-avatars.com/api/?name=${encodeURIComponent(
                          username
                        )}`}
                        alt="User Profile"
                        className="w-full h-full object-cover"
                      />
                    </button>

                    {dropdownOpen && (
                      <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50">
                        <div className="px-4 py-2 border-b border-gray-100 dark:border-gray-700 text-gray-800 dark:text-white font-semibold">
                          {username}
                        </div>

                        <button
                          className="flex items-center w-full px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                          onClick={() => {
                            setLocation("/settings");
                            setDropdownOpen(false);
                          }}
                        >
                          <Settings className="w-4 h-4 mr-2" />
                          {t("Landing.header.Settings")}
                        </button>
                        <button
                          className="flex items-center w-full px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                          onClick={() => {
                            setLocation("/account");
                            setDropdownOpen(false);
                          }}
                        >
                          <User className="w-4 h-4 mr-2" />{" "}
                          {t("Landing.header.Account")}
                        </button>
                        <button
                          className="flex items-center w-full px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                          onClick={() => {
                            logout();
                            setDropdownOpen(false);
                          }}
                        >
                          <LogOut className="w-4 h-4 mr-2" />{" "}
                          {t("Landing.header.logout")}
                        </button>
                      </div>
                    )}
                  </div>
                </>
              )}
            </nav>

            {/* Mobile Menu Toggle */}
            <button
              className="lg:hidden p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              onClick={handleMenuToggle}
              aria-label="Toggle menu"
              aria-expanded={isMenuOpen}
            >
              {isMenuOpen ? (
                <X className="w-5 h-5 sm:w-6 sm:h-6 text-gray-700 dark:text-gray-300" />
              ) : (
                <Menu className="w-5 h-5 sm:w-6 sm:h-6 text-gray-700 dark:text-gray-300" />
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Menu */}
      {isMenuOpen && (
        <div className="lg:hidden bg-white dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800 shadow-lg fixed top-14 sm:top-16 left-0 right-0 z-30 max-h-[calc(100vh-3.5rem)] sm:max-h-[calc(100vh-4rem)] overflow-y-auto">
          <div className="px-4 py-4 space-y-3">
            <Link
              href="/"
              className={`block py-2 hover:text-green-600 dark:hover:text-green-500 font-medium text-sm sm:text-base ${location === "/"
                  ? "text-green-600 dark:text-green-500"
                  : "text-gray-700 dark:text-gray-300"
                }`}
              onClick={() => setIsMenuOpen(false)}
            >
              {t("Landing.header.Navlinks.0")}
            </Link>

            {/* About Accordion */}
            <div className="space-y-2">
              <button
                className="flex items-center justify-between w-full py-2 text-gray-900 dark:text-white font-semibold text-sm sm:text-base"
                onClick={() => setShowAboutMobile(!showAboutMobile)}
                aria-expanded={showAboutMobile}
              >
                <span> {t("Landing.header.Navlinks.1")}</span>
                <ChevronDown
                  className={`w-4 h-4 transition-transform duration-200 ${showAboutMobile ? "rotate-180" : ""
                    }`}
                />
              </button>

              <div
                className={`grid overflow-hidden transition-all duration-300 ease-in-out ${showAboutMobile
                    ? "grid-rows-[1fr] opacity-100"
                    : "grid-rows-[0fr] opacity-0"
                  }`}
              >
                <div className="overflow-hidden">
                  <div className="space-y-2 pl-4">
                    {staticData.header.aboutMenuItems.map((item, index) => (
                      <Link
                        key={`mobile-about-${index}`}
                        href={item.path}
                        className="flex items-center py-2 text-gray-700 dark:text-gray-300 hover:text-green-600 dark:hover:text-green-500 font-medium text-sm sm:text-base gap-2"
                        onClick={() => setIsMenuOpen(false)}
                      >
                        <item.icon className="w-4 h-4 text-green-600" />
                        {item.title}
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Resources Accordion */}
            <div className="space-y-2">
              <button
                className="flex items-center justify-between w-full py-2 text-gray-900 dark:text-white font-semibold text-sm sm:text-base"
                onClick={() => setShowResourcesMobile(!showResourcesMobile)}
                aria-expanded={showResourcesMobile}
              >
                <span>Resources</span>
                <ChevronDown
                  className={`w-4 h-4 transition-transform duration-200 ${showResourcesMobile ? "rotate-180" : ""
                    }`}
                />
              </button>

              <div
                className={`grid overflow-hidden transition-all duration-300 ease-in-out ${showResourcesMobile
                    ? "grid-rows-[1fr] opacity-100"
                    : "grid-rows-[0fr] opacity-0"
                  }`}
              >
                <div className="overflow-hidden">
                  <div className="space-y-2 pl-4">
                    {staticData.header.resourcesMenuItems.map((item, index) => (
                      <Link
                        key={`mobile-resources-${index}`}
                        href={item.path}
                        className="flex items-center py-2 text-gray-700 dark:text-gray-300 hover:text-green-600 dark:hover:text-green-500 font-medium text-sm sm:text-base gap-2"
                        onClick={() => setIsMenuOpen(false)}
                      >
                        <item.icon className="w-4 h-4 text-green-600" />
                        {item.title}
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {!isAuthenticated ? (
              <>
                <Link
                  href="/login"
                  onClick={() => {
                    setIsMenuOpen(false);
                    handleLogin();
                  }}
                  className="block w-full text-left py-2 text-gray-700 dark:text-gray-300 hover:text-green-600 dark:hover:text-green-500 font-medium text-sm sm:text-base"
                >
                  {loginLoading ? (
                    <LoadingAnimation size="sm" color="green" />
                  ) : (
                    "Login"
                  )}
                </Link>

                <Link
                  href="/login"
                  onClick={() => {
                    setIsMenuOpen(false);
                    handleGetStarted();
                  }}
                  className="w-full bg-gradient-to-r from-green-500 to-green-600 text-white py-2.5 sm:py-3 rounded-lg hover:from-green-600 hover:to-green-700 transition-all font-medium flex items-center justify-center text-sm sm:text-base"
                >
                  {getStartedLoading ? (
                    <LoadingAnimation size="sm" color="white" />
                  ) : (
                    <>
                      {t("Landing.header.Navlinks.3")}
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </>
                  )}
                </Link>
              </>
            ) : (
              <>
                <Link
                  href="/dashboard"
                  className="block py-2 text-gray-700 dark:text-gray-300 hover:text-green-600 dark:hover:text-green-500 font-medium text-sm sm:text-base"
                  onClick={() => setIsMenuOpen(false)}
                >
                  {t("Landing.header.Navlinks.3")}
                </Link>

                <div className="border-t border-gray-200 dark:border-gray-700 pt-3 mt-3">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-gray-200">
                      <img
                        src={`https://ui-avatars.com/api/?name=${encodeURIComponent(
                          username
                        )}`}
                        alt="User Profile"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <span className="text-gray-800 dark:text-white font-semibold">
                      {username}
                    </span>
                  </div>

                  <div className="space-y-2">
                    <button
                      className="flex items-center w-full px-3 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
                      onClick={() => {
                        setLocation("/settings");
                        setIsMenuOpen(false);
                      }}
                    >
                      <Settings className="w-4 h-4 mr-2" />{" "}
                      {t("Landing.header.Settings")}
                    </button>
                    <button
                      className="flex items-center w-full px-3 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
                      onClick={() => {
                        setLocation("/account");
                        setIsMenuOpen(false);
                      }}
                    >
                      <User className="w-4 h-4 mr-2" />{" "}
                      {t("Landing.header.Account")}
                    </button>
                    <button
                      className="flex items-center w-full px-3 py-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                      onClick={() => {
                        logout();
                        setIsMenuOpen(false);
                      }}
                    >
                      <LogOut className="w-4 h-4 mr-2" />{" "}
                      {t("Landing.header.logout")}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Overlay for mega menus */}
      {(showAboutMega || showResourcesMega) && (
        <div
          className="fixed inset-0 bg-black/10 dark:bg-black/30 z-30"
          onClick={closeMegaMenus}
        />
      )}
    </>
  );
};

export default Header;
