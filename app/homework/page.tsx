import Link from "next/link";
import { Settings, Play, BookOpen, Users } from "lucide-react";
import styles from "./welcome.module.css";

const quickLinks = [
  {
    href: "/homework/builder",
    label: "ממשק הבנייה",
    description: "יצירה וניהול של מטלות SQL (עד 25 שאלות)",
    icon: <Settings size={24} />,
    color: "primary",
  },
  {
    href: "/homework/start",
    label: "ממשק הסטודנט",
    description: "חוויית פתרון המטלות עבור הסטודנטים",
    icon: <Play size={24} />,
    color: "secondary",
  },
  {
    href: "/homework/questions",
    label: "בנק השאלות",
    description: "ניהול ויצירת שאלות למטלות הבית",
    icon: <BookOpen size={24} />,
    color: "tertiary",
  },
];

export default function HomeworkLandingPage() {
  return (
    <div className={styles.container} dir="rtl">
      <section className={styles.hero}>
        <div className={styles.heroIcon}>
          <Users size={32} />
        </div>
        <h2>מודול שיעורי הבית</h2>
        <p>סביבות בונה ותלמיד לשיעורי הבית המלאים</p>
      </section>

      <section className={styles.links}>
        {quickLinks.map((link) => (
          <Link key={link.href} href={link.href} className={`${styles.linkCard} ${styles[link.color]}`}>
            <div className={styles.linkIcon}>
              {link.icon}
            </div>
            <div className={styles.linkContent}>
              <span className={styles.linkTitle}>{link.label}</span>
              <span className={styles.linkDescription}>{link.description}</span>
            </div>
          </Link>
        ))}
      </section>
    </div>
  );
}
