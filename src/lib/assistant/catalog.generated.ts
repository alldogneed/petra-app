// GENERATED FILE — do not edit by hand.
// Source: scripts/build-assistant-knowledge.mjs (run it after changing the help
// center, the menu, the settings tabs, the plans or the tutorial videos).

/** Main-menu screens, exactly as named in the sidebar. */
export const ASSISTANT_SCREENS: { href: string; name: string }[] = [
  {
    "href": "/dashboard",
    "name": "דשבורד"
  },
  {
    "href": "/customers",
    "name": "לקוחות"
  },
  {
    "href": "/leads",
    "name": "מערכת מכירות"
  },
  {
    "href": "/tasks",
    "name": "ניהול משימות"
  },
  {
    "href": "/scheduler",
    "name": "ניהול תורים אונליין"
  },
  {
    "href": "/calendar",
    "name": "יומן"
  },
  {
    "href": "/boarding",
    "name": "פנסיון"
  },
  {
    "href": "/service-dogs",
    "name": "ניהול כלבי שירות"
  },
  {
    "href": "/training",
    "name": "ניהול תהליכי אילוף"
  },
  {
    "href": "/pets",
    "name": "חיות מחמד"
  },
  {
    "href": "/online-classes",
    "name": "שיעורים אונליין"
  },
  {
    "href": "/help/connect-ai",
    "name": "עוזר AI"
  },
  {
    "href": "/pricing",
    "name": "פיננסים"
  },
  {
    "href": "/scheduled-messages",
    "name": "הודעות"
  },
  {
    "href": "/analytics",
    "name": "דוחות"
  },
  {
    "href": "/business-admin",
    "name": "ניהול ובקרה"
  },
  {
    "href": "/tutorials",
    "name": "סרטוני הדרכה"
  },
  {
    "href": "/settings",
    "name": "הגדרות"
  }
];

/** Tutorial videos by id — resolves the `video:<id>` links in the assistant's answers. */
export const ASSISTANT_VIDEOS: Record<string, { title: string; url: string; durationLabel: string }> = {
  "dashboard": {
    "title": "דשבורד",
    "url": "https://vd0izwltrfibbypf.public.blob.vercel-storage.com/tutorials/%D7%93%D7%A9%D7%91%D7%95%D7%A8%D7%93%20-%20%D7%94%D7%93%D7%A8%D7%9B%D7%94.mp4",
    "durationLabel": "1:09"
  },
  "calendar": {
    "title": "יומן",
    "url": "https://vd0izwltrfibbypf.public.blob.vercel-storage.com/tutorials/%D7%99%D7%95%D7%9E%D7%9F%20%D7%A4%D7%98%D7%A8%D7%94%20-%20%D7%94%D7%93%D7%A8%D7%9B%D7%94.mp4",
    "durationLabel": "0:48"
  },
  "customers": {
    "title": "מערכת לקוחות",
    "url": "https://vd0izwltrfibbypf.public.blob.vercel-storage.com/tutorials/%D7%9E%D7%A2%D7%A8%D7%9B%D7%AA%20%D7%9C%D7%A7%D7%95%D7%97%D7%95%D7%AA%20-%20%D7%94%D7%93%D7%A8%D7%9B%D7%94%20.mp4",
    "durationLabel": "1:47"
  },
  "pets": {
    "title": "חיות מחמד",
    "url": "https://vd0izwltrfibbypf.public.blob.vercel-storage.com/tutorials/%D7%97%D7%99%D7%95%D7%AA%20%D7%9E%D7%97%D7%9E%D7%93%20-%20%D7%94%D7%93%D7%A8%D7%9B%D7%94.mp4",
    "durationLabel": "0:40"
  },
  "sales": {
    "title": "מערכת מכירות",
    "url": "https://vd0izwltrfibbypf.public.blob.vercel-storage.com/tutorials/%D7%9E%D7%A2%D7%A8%D7%9B%D7%AA%20%D7%9E%D7%9B%D7%99%D7%A8%D7%95%D7%AA%20-%20%D7%94%D7%93%D7%A8%D7%9B%D7%94%20.mp4",
    "durationLabel": "1:18"
  },
  "tasks": {
    "title": "מערכת משימות",
    "url": "https://vd0izwltrfibbypf.public.blob.vercel-storage.com/tutorials/%D7%9E%D7%A2%D7%A8%D7%9B%D7%AA%20%D7%9E%D7%A9%D7%99%D7%9E%D7%95%D7%AA%20-%20%D7%94%D7%93%D7%A8%D7%9B%D7%94%20.mp4",
    "durationLabel": "1:31"
  },
  "booking-online": {
    "title": "הזמנות אונליין",
    "url": "https://vd0izwltrfibbypf.public.blob.vercel-storage.com/tutorials/%D7%94%D7%96%D7%9E%D7%A0%D7%95%D7%AA%20%D7%90%D7%95%D7%A0%D7%9C%D7%99%D7%99%D7%9F%20-%20%D7%94%D7%93%D7%A8%D7%9B%D7%94.mp4",
    "durationLabel": "1:18"
  },
  "orders": {
    "title": "מערכת הזמנות",
    "url": "https://vd0izwltrfibbypf.public.blob.vercel-storage.com/tutorials/%D7%9E%D7%A2%D7%A8%D7%9B%D7%AA%20%D7%94%D7%96%D7%9E%D7%A0%D7%95%D7%AA%20-%20%D7%94%D7%93%D7%A8%D7%9B%D7%94%20.mp4",
    "durationLabel": "1:33"
  },
  "finances": {
    "title": "מערכת פיננסים",
    "url": "https://vd0izwltrfibbypf.public.blob.vercel-storage.com/tutorials/%D7%9E%D7%A2%D7%A8%D7%9B%D7%AA%20%D7%A4%D7%99%D7%A0%D7%A0%D7%A1%D7%99%D7%9D%20-%20%D7%94%D7%93%D7%A8%D7%9B%D7%94%20.mp4",
    "durationLabel": "2:09"
  },
  "boarding": {
    "title": "מערכת הפנסיון",
    "url": "https://vd0izwltrfibbypf.public.blob.vercel-storage.com/tutorials/%D7%9E%D7%A2%D7%A8%D7%9B%D7%AA%20%D7%94%D7%A4%D7%A0%D7%A1%D7%99%D7%95%D7%9F%20-%20%D7%94%D7%93%D7%A8%D7%9B%D7%94.mp4",
    "durationLabel": "2:08"
  },
  "admin": {
    "title": "לוח ובקרה",
    "url": "https://vd0izwltrfibbypf.public.blob.vercel-storage.com/tutorials/%D7%9C%D7%95%D7%97%20%D7%95%D7%94%D7%A7%D7%A8%D7%94%20-%20%D7%94%D7%93%D7%A8%D7%9B%D7%94.mp4",
    "durationLabel": "1:01"
  },
  "training": {
    "title": "ניהול תהליכי אילוף",
    "url": "https://vd0izwltrfibbypf.public.blob.vercel-storage.com/tutorials/%D7%A0%D7%99%D7%94%D7%95%D7%9C%20%D7%AA%D7%94%D7%9C%D7%99%D7%9B%D7%99%20%D7%90%D7%99%D7%9C%D7%95%D7%A3%20-%20%D7%94%D7%93%D7%A8%D7%9B%D7%94%20.mp4",
    "durationLabel": "1:38"
  },
  "settings": {
    "title": "הגדרות",
    "url": "https://vd0izwltrfibbypf.public.blob.vercel-storage.com/tutorials/%D7%94%D7%92%D7%93%D7%A8%D7%95%D7%AA%20%D7%94%D7%93%D7%A8%D7%9B%D7%94.mp4",
    "durationLabel": "2:22"
  }
};
