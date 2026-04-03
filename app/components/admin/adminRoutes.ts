import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  BookOpen,
  Brain,
  Coins,
  Database,
  FileText,
  FolderKanban,
  GraduationCap,
  Home,
  LayoutDashboard,
  MessageSquare,
  Search,
  Settings2,
  Sparkles,
  Users,
} from "lucide-react";

export type AdminBucketId =
  | "daily-ops"
  | "content-assessment"
  | "student-intelligence"
  | "platform-tools";

export interface AdminBucket {
  id: AdminBucketId;
  label: string;
  description: string;
}

export interface AdminRouteConfig {
  id: string;
  href: string;
  label: string;
  shortLabel?: string;
  description: string;
  whyOpen: string;
  bucket: AdminBucketId;
  icon: LucideIcon;
  nav?: boolean;
  tile?: boolean;
  searchable?: boolean;
  keywords?: string[];
  parentId?: string;
  exact?: boolean;
}

export interface AdminCommandConfig {
  id: string;
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
  keywords?: string[];
}

export const ADMIN_BUCKETS: AdminBucket[] = [
  {
    id: "daily-ops",
    label: "תפעול יומיומי",
    description: "הפעולות שהאדמין צריך להגיע אליהן מהר, בלי לחפש.",
  },
  {
    id: "content-assessment",
    label: "תוכן והערכה",
    description: "ניהול מטלות, שאלות, תבניות, מסדי נתונים ומבחנים.",
  },
  {
    id: "student-intelligence",
    label: "מודיעין סטודנטים",
    description: "תמונת מצב לימודית, פרופילים, ניתוחי AI ודוחות.",
  },
  {
    id: "platform-tools",
    label: "כלי פלטפורמה",
    description: "קונפיגורציה, מודלים, עוזרי מערכת וכלי בדיקה.",
  },
];

export const ADMIN_ROUTES: AdminRouteConfig[] = [
  {
    id: "admin-home",
    href: "/admin",
    label: "מרכז פיקוד",
    shortLabel: "בית",
    description: "דף הבית התפעולי של ממשק הניהול.",
    whyOpen: "כדי להבין מה דורש טיפול עכשיו ולקפוץ לפעולה הבאה.",
    bucket: "daily-ops",
    icon: Home,
    nav: true,
    tile: false,
    searchable: true,
    keywords: ["admin", "dashboard", "overview", "home", "בית", "פיקוד"],
    exact: true,
  },
  {
    id: "admin-users",
    href: "/admin/users",
    label: "ניהול משתמשים",
    description: "יצירה, עריכה, איפוס סיסמה ופעולות מרובות על משתמשים.",
    whyOpen: "כדי לטפל מהר בסטודנט בודד או בפעולת אדמין רוחבית.",
    bucket: "daily-ops",
    icon: Users,
    nav: true,
    tile: true,
    searchable: true,
    keywords: ["users", "students", "reset password", "bulk", "משתמשים", "סיסמה"],
  },
  {
    id: "admin-settings",
    href: "/admin/settings",
    label: "הגדרות מערכת",
    description: "שליטה בזמינות Michael, נראות מטבעות וכלי תפעול קריטיים.",
    whyOpen: "כדי להפעיל, לכבות או לבדוק את מצב המערכת לפני שמשהו נשבר.",
    bucket: "daily-ops",
    icon: Settings2,
    nav: true,
    tile: true,
    searchable: true,
    keywords: ["settings", "michael", "coins", "system", "הגדרות", "מערכת"],
  },
  {
    id: "admin-coins",
    href: "/admin/coins",
    label: "מטבעות וחיובים",
    description: "ניהול תמחור, יתרות, שימושים ומודולי חיוב.",
    whyOpen: "כדי לבדוק השפעת חיובים ולעדכן יתרות בלי לעבור דרך כמה מסכים.",
    bucket: "daily-ops",
    icon: Coins,
    nav: true,
    tile: true,
    searchable: true,
    keywords: ["coins", "billing", "balances", "מטבעות", "חיובים"],
  },
  {
    id: "admin-homework",
    href: "/admin/homework",
    label: "מטלות ובחינות",
    description: "מרחב העבודה הראשי של בניית מטלות, תצוגה מקדימה ופרסום.",
    whyOpen: "כדי להמשיך בדיוק מהמקום שבו בנית או פרסמת מטלה.",
    bucket: "content-assessment",
    icon: FolderKanban,
    nav: true,
    tile: true,
    searchable: true,
    keywords: ["homework", "assignments", "builder", "מטלות", "בחינות"],
  },
  {
    id: "admin-question-bank",
    href: "/homework/questions",
    label: "בנק שאלות",
    description: "עבודה ישירה על שאלות קיימות, פרמטרים ותוכן.",
    whyOpen: "כדי למצוא ולשנות שאלה בלי להיכנס לכל מרחב הבנייה.",
    bucket: "content-assessment",
    icon: Search,
    nav: true,
    tile: true,
    searchable: true,
    keywords: ["questions", "bank", "question bank", "שאלות"],
  },
  {
    id: "admin-templates",
    href: "/admin/templates",
    label: "תבניות שאלות",
    description: "ניהול תבניות פרמטריות ויצירת וריאציות דינמיות.",
    whyOpen: "כדי לייצר שאלות עקביות ולמחזר לוגיקה בין מטלות.",
    bucket: "content-assessment",
    icon: FileText,
    nav: true,
    tile: true,
    searchable: true,
    keywords: ["templates", "template", "תבניות", "פרמטרים"],
  },
  {
    id: "admin-templates-new",
    href: "/admin/templates/new",
    label: "יצירת תבנית חדשה",
    description: "מסך יצירת תבנית חדשה.",
    whyOpen: "כדי להתחיל תבנית מאפס.",
    bucket: "content-assessment",
    icon: FileText,
    searchable: true,
    keywords: ["new template", "יצירת תבנית"],
    parentId: "admin-templates",
  },
  {
    id: "admin-exam-generator",
    href: "/admin/exam-generator",
    label: "יצירת מבחן",
    description: "בניית מבחן חדש על בסיס מבחנים קודמים וקבצי PDF.",
    whyOpen: "כדי לבנות מבחן חדש בלי לעזוב את סביבת הניהול.",
    bucket: "content-assessment",
    icon: GraduationCap,
    nav: true,
    tile: true,
    searchable: true,
    keywords: ["exam", "generator", "מבחן", "יצירה"],
  },
  {
    id: "admin-databases",
    href: "/admin/databases",
    label: "מסדי נתונים לתרגילים",
    description: "יצירה ותחזוקה של סכמות SQL למטלות ולתרגול.",
    whyOpen: "כדי להקים או לעדכן סביבת נתונים לתוכן לימודי.",
    bucket: "content-assessment",
    icon: Database,
    nav: true,
    tile: true,
    searchable: true,
    keywords: ["database", "schema", "sql", "מסדי נתונים"],
  },
  {
    id: "admin-datasets",
    href: "/admin/datasets",
    label: "דאטה-סטים",
    description: "הרחבה, ולידציה ותצוגה מקדימה של סטים לימודיים.",
    whyOpen: "כדי לייצר נתונים בצורה נשלטת ולבדוק את איכותם.",
    bucket: "content-assessment",
    icon: LayoutDashboard,
    nav: true,
    tile: true,
    searchable: true,
    keywords: ["datasets", "data", "preview", "דאטה", "נתונים"],
  },
  {
    id: "admin-students",
    href: "/admin/students",
    label: "פרופילי סטודנטים",
    description: "תמונה אישית של כל סטודנט, סיכונים, אתגרים והתקדמות.",
    whyOpen: "כדי להבין מי צריך התערבות, ומה מצבו האקדמי.",
    bucket: "student-intelligence",
    icon: Users,
    nav: true,
    tile: true,
    searchable: true,
    keywords: ["students", "profiles", "risk", "סטודנטים", "פרופילים"],
  },
  // {
  //   id: "admin-analysis",
  //   href: "/admin/analysis",
  //   label: "ניתוחי AI",
  //   description: "סקירת תוצאות ניתוח, סקירות ממתינות וטריגרים ידניים.",
  //   whyOpen: "כדי לבדוק ניתוחים ממתינים ולהניע ניתוח חדש כשצריך.",
  //   bucket: "student-intelligence",
  //   icon: Brain,
  //   nav: true,
  //   tile: true,
  //   searchable: true,
  //   keywords: ["analysis", "AI", "reviews", "ניתוחים", "ai"],
  // },
  {
    id: "admin-weekly-analytics",
    href: "/admin/weekly-analytics",
    label: "אנליטיקה שבועית",
    description: "מבט שבועי על שימוש, מעורבות ותנועת למידה.",
    whyOpen: "כדי להבין מגמות ולא רק מקרי קצה.",
    bucket: "student-intelligence",
    icon: BarChart3,
    nav: true,
    tile: true,
    searchable: true,
    keywords: ["weekly", "analytics", "אנליטיקה שבועית"],
  },
  // {
  //   id: "admin-exam-prep-analytics",
  //   href: "/admin/exam-prep-analytics",
  //   label: "אנליטיקת הכנה למבחן",
  //   description: "איתור סטודנטים ומקטעים חלשים לפני מבחן.",
  //   whyOpen: "כדי להבין מי מוכן ומי צריך חיזוק ממוקד.",
  //   bucket: "student-intelligence",
  //   icon: BarChart3,
  //   nav: true,
  //   tile: true,
  //   searchable: true,
  //   keywords: ["exam prep", "analytics", "הכנה למבחן"],
  // },
  // {
  //   id: "admin-chat-report",
  //   href: "/admin/chat-report",
  //   label: "דוח צ׳אט",
  //   description: "פירוק שימושי Michael לפי תקופה, משתמש ונושאים חוזרים.",
  //   whyOpen: "כדי לראות מה באמת נשאל בצ׳אט ומה דורש תיקון בתוכן.",
  //   bucket: "student-intelligence",
  //   icon: MessageSquare,
  //   nav: true,
  //   tile: true,
  //   searchable: true,
  //   keywords: ["chat report", "michael", "report", "צאט", "דוח"],
  // },
  {
    id: "admin-model-management",
    href: "/admin/model-management",
    label: "ניהול מודלי AI",
    description: "קונפיגורציית runtime, פיצ׳רים וכלי בדיקת מודלים.",
    whyOpen: "כדי לבדוק שהמודל הנכון רץ ולשלוט בשינויים תפעוליים.",
    bucket: "platform-tools",
    icon: Brain,
    nav: true,
    tile: true,
    searchable: true,
    keywords: ["model", "runtime", "openai", "מודלים"],
  },
  {
    id: "admin-mcp-michael",
    href: "/admin/mcp-michael",
    label: "MCP Michael",
    description: "ניהול קונטקסט סמסטריאלי ותוכן שבועי עבור Michael.",
    whyOpen: "כדי לעדכן את עוזר הלמידה למה שהקורס באמת לומד השבוע.",
    bucket: "platform-tools",
    icon: Database,
    nav: true,
    tile: true,
    searchable: true,
    keywords: ["mcp", "michael", "semester", "שבועי"],
  },
  {
    id: "admin-test-gpt",
    href: "/admin/test-gpt",
    label: "בדיקות GPT",
    description: "בדיקת pipeline של Responses וכלי admin בלבד.",
    whyOpen: "כדי לבדוק יכולות, רגרסיות והתנהגות runtime בסביבה אחת.",
    bucket: "platform-tools",
    icon: Sparkles,
    nav: true,
    tile: true,
    searchable: true,
    keywords: ["test gpt", "responses", "בדיקות", "gpt"],
  },
];

export const ADMIN_PINNED_ROUTE_IDS = [
  "admin-users",
  "admin-settings",
  "admin-homework",
  "admin-templates",
] as const;

export const ADMIN_COMMANDS: AdminCommandConfig[] = [
  {
    id: "command-add-user",
    href: "/admin/users?panel=add",
    label: "הוסף משתמש חדש",
    description: "פתיחת מסך המשתמשים עם טופס יצירה פתוח.",
    icon: Users,
    keywords: ["add user", "new user", "הוסף משתמש"],
  },
  {
    id: "command-open-coins",
    href: "/admin/coins",
    label: "התאם מטבעות",
    description: "מעבר ישיר למסך מטבעות וחיובים.",
    icon: Coins,
    keywords: ["coins", "billing", "adjust", "מטבעות"],
  },
  {
    id: "command-open-extra-time",
    href: "/admin/settings#extra-time",
    label: "העלה התאמות זמן",
    description: "קיצור למסך העלאת קובץ התאמות זמן לבחינה.",
    icon: Settings2,
    keywords: ["extra time", "upload", "התאמות זמן"],
  },
  {
    id: "command-open-datasets",
    href: "/admin/datasets",
    label: "פתח דאטה-סטים",
    description: "מעבר ישיר למסך הדאטה-סטים.",
    icon: Database,
    keywords: ["datasets", "data", "preview", "נתונים"],
  },
];

function normalizePathname(pathname?: string | null) {
  if (!pathname) return "/admin";
  if (pathname.length > 1 && pathname.endsWith("/")) {
    return pathname.slice(0, -1);
  }
  return pathname;
}

export function getAdminRouteMatch(pathname?: string | null): AdminRouteConfig | null {
  const normalizedPath = normalizePathname(pathname);
  const orderedRoutes = [...ADMIN_ROUTES].sort((left, right) => right.href.length - left.href.length);

  for (const route of orderedRoutes) {
    const exact = route.exact ?? false;
    if (exact) {
      if (normalizedPath === route.href) {
        return route;
      }
      continue;
    }

    if (normalizedPath === route.href || normalizedPath.startsWith(`${route.href}/`)) {
      return route;
    }
  }

  return null;
}

export function getAdminBreadcrumbs(pathname?: string | null): AdminRouteConfig[] {
  const match = getAdminRouteMatch(pathname);
  const home = ADMIN_ROUTES.find((route) => route.id === "admin-home");
  if (!match || !home) return [];
  if (match.id === home.id) return [home];

  const trail: AdminRouteConfig[] = [home];
  const ancestors: AdminRouteConfig[] = [];
  let currentParentId = match.parentId;

  while (currentParentId) {
    const parent = ADMIN_ROUTES.find((route) => route.id === currentParentId);
    if (!parent) break;
    ancestors.unshift(parent);
    currentParentId = parent.parentId;
  }

  return [...trail, ...ancestors, match];
}

export function getRoutesForBucket(bucketId: AdminBucketId) {
  return ADMIN_ROUTES.filter((route) => route.bucket === bucketId && route.nav);
}

export function getTileRoutesForBucket(bucketId: AdminBucketId) {
  return ADMIN_ROUTES.filter((route) => route.bucket === bucketId && route.tile);
}

export function getAdminCommandItems() {
  const searchableRoutes = ADMIN_ROUTES.filter((route) => route.searchable !== false);

  return [
    ...searchableRoutes.map((route) => ({
      id: route.id,
      href: route.href,
      label: route.label,
      description: route.description,
      icon: route.icon,
      keywords: route.keywords || [],
    })),
    ...ADMIN_COMMANDS,
  ];
}

export function getPinnedRoutes() {
  return ADMIN_PINNED_ROUTE_IDS.map((id) => ADMIN_ROUTES.find((route) => route.id === id)).filter(
    (route): route is AdminRouteConfig => Boolean(route)
  );
}
