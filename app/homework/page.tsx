import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { ArrowUpLeft, BookOpen, ClipboardList, Play, Settings, Users } from "lucide-react";
import styles from "./welcome.module.css";

const quickLinks = [
  {
    href: "/homework/builder",
    label: "ממשק הבנייה",
    description: "יצירה וניהול של מטלות SQL (עד 25 שאלות)",
    meta: "ניהול מטלות",
    icon: <Settings size={22} />,
    tone: "primary",
  },
  {
    href: "/homework/start",
    label: "ממשק הסטודנט",
    description: "חוויית פתרון המטלות עבור הסטודנטים",
    meta: "תצוגת תלמיד",
    icon: <Play size={22} />,
    tone: "secondary",
  },
  {
    href: "/homework/questions",
    label: "בנק השאלות",
    description: "ניהול ויצירת שאלות למטלות הבית",
    meta: "מאגר תוכן",
    icon: <BookOpen size={22} />,
    tone: "tertiary",
  },
];

export default async function HomeworkLandingPage() {
  const requestHeaders = await headers();
  const authenticatedRole = requestHeaders.get("x-michael-authenticated-role");

  if (authenticatedRole !== "admin") {
    redirect("/homework/start");
  }

  return (
    <div className={styles.container} dir="rtl">
      <section className={styles.headerPanel}>
        <div className={styles.headerCopy}>
          <div className={styles.headerIcon}>
            <Users size={24} />
          </div>
          <div>
            <p className={styles.eyebrow}>מרכז ניהול</p>
            <h1>מודול שיעורי הבית</h1>
            <p>גישה מהירה לבנייה, בדיקה וניהול של תרגילי SQL.</p>
          </div>
        </div>

        <div className={styles.headerStatus} aria-label="מצב מודול">
          <ClipboardList size={18} />
          <span>3 סביבות עבודה</span>
        </div>
      </section>

      <section className={styles.links}>
        {quickLinks.map((link) => (
          <Link key={link.href} href={link.href} className={styles.linkCard} data-tone={link.tone}>
            <div className={styles.linkIcon}>
              {link.icon}
            </div>
            <div className={styles.linkContent}>
              <span className={styles.linkMeta}>{link.meta}</span>
              <span className={styles.linkTitle}>{link.label}</span>
              <span className={styles.linkDescription}>{link.description}</span>
            </div>
            <span className={styles.linkAction} aria-hidden="true">
              <ArrowUpLeft size={18} />
            </span>
          </Link>
        ))}
      </section>
    </div>
  );
}
