"use client";

import { useEffect } from "react";

/**
 * 官網首頁的互動行為：導覽列狀態、漢堡選單、捲動高亮、進場動畫。
 * 由靜態版 assets/js/main.js 移植而來；預約表單已改由 /card/booking 接手，
 * 所以原本的「複製訊息開 LINE」邏輯不再需要。
 */
export default function SiteInteractions() {
  useEffect(() => {
    const nav = document.getElementById("nav");
    const burger = document.getElementById("burger");
    const cleanups: Array<() => void> = [];

    /* 捲動時的導覽列陰影 */
    const onScroll = () => nav?.classList.toggle("is-stuck", window.scrollY > 12);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    cleanups.push(() => window.removeEventListener("scroll", onScroll));

    /* 漢堡選單 */
    if (nav && burger) {
      const toggle = () => {
        const open = nav.classList.toggle("is-open");
        burger.setAttribute("aria-expanded", String(open));
        burger.setAttribute("aria-label", open ? "關閉選單" : "開啟選單");
      };
      burger.addEventListener("click", toggle);
      cleanups.push(() => burger.removeEventListener("click", toggle));

      const close = () => {
        nav.classList.remove("is-open");
        burger.setAttribute("aria-expanded", "false");
      };
      nav.querySelectorAll(".nav__links a").forEach((a) => {
        a.addEventListener("click", close);
        cleanups.push(() => a.removeEventListener("click", close));
      });
    }

    /* 捲動高亮目前區塊 */
    const links = Array.from(document.querySelectorAll<HTMLAnchorElement>('.nav__links a[href^="#"]'));
    const sections = links
      .map((a) => document.querySelector(a.getAttribute("href") as string))
      .filter((el): el is Element => Boolean(el));

    if ("IntersectionObserver" in window && sections.length) {
      const spy = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            links.forEach((a) =>
              a.classList.toggle("is-active", a.getAttribute("href") === `#${entry.target.id}`)
            );
          });
        },
        { rootMargin: "-45% 0px -50% 0px" }
      );
      sections.forEach((s) => spy.observe(s));
      cleanups.push(() => spy.disconnect());
    }

    /* 進場動畫 */
    if ("IntersectionObserver" in window) {
      const targets = document.querySelectorAll<HTMLElement>(
        ".section__title, .section__sub, .card, .stat, .focus, .quote, .flow, .prose, .contact, .book__quick, .book__intro"
      );
      const io = new IntersectionObserver(
        (entries, obs) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            entry.target.classList.add("is-in");
            obs.unobserve(entry.target);
          });
        },
        { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
      );
      targets.forEach((el, i) => {
        el.classList.add("reveal");
        el.style.transitionDelay = `${(i % 4) * 70}ms`;
        io.observe(el);
      });
      cleanups.push(() => io.disconnect());
    }

    return () => cleanups.forEach((fn) => fn());
  }, []);

  return null;
}
