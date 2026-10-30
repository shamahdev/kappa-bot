export const DEMO_JOBS = [
  {
    id: 1,
    title: "Backend engineer",
    company: "Example team",
    location: "Jakarta",
    source: "Kalibrr",
    summary: "Build APIs and work on the services behind a web application.",
  },
  {
    id: 2,
    title: "Product designer",
    company: "Example studio",
    location: "Remote",
    source: "Glints",
    summary:
      "Design product flows, test ideas and work closely with engineers.",
  },
  {
    id: 3,
    title: "Frontend engineer",
    company: "Example company",
    location: "Jakarta",
    source: "Jobstreet",
    summary:
      "Build accessible interfaces and improve the experience across devices.",
  },
] as const;

export const DISCORD_DEMO_JOBS = [
  { id: 1, title: "Social Media Support Internship", company: "Dekoruma" },
  {
    id: 2,
    title: "Business Development Representative",
    company: "PT Giftee International Indonesia",
  },
  { id: 3, title: "IT Specialist", company: "Sakuraland" },
  {
    id: 4,
    title: "Customer Relationship Executive Branch Bandung",
    company: "PT BFI Finance Indonesia Tbk",
  },
] as const;

// Excerpt transcribed from the supplied image.png, not a live posting feed.
export const DISCORD_DEMO_SUMMARY = {
  reply: 3,
  title: "IT Specialist @ Sakuraland",
  role: "IT Specialist di Bekasi Kota, fokus pada pengembangan aplikasi internal, manajemen aset IT, dan supervisi tim teknis.",
  responsibilities: [
    "Mengembangkan program/aplikasi internal sesuai kebutuhan bisnis.",
    "Maintenance, troubleshooting, dan pengembangan aplikasi existing.",
    "Dokumentasi dan pencatatan seluruh perangkat IT (komputer, laptop, printer).",
    "Monitoring kondisi, penggunaan, dan pemeliharaan aset IT.",
    "Mengawasi dan mengarahkan kinerja tim IT.",
    "Memberikan dukungan teknis dan solusi kendala IT untuk semua divisi.",
    "Menyusun laporan berkala (perkembangan aplikasi, aset, kinerja tim).",
  ],
  skills: [
    "Pengalaman dalam manajemen aset IT (IT Asset Management).",
    "Kemampuan memimpin dan mengelola tim IT.",
    "Pemahaman mendalam tentang infrastruktur IT perusahaan.",
  ],
  location: "Bekasi Kota",
} as const;
export type DemoJob = (typeof DEMO_JOBS)[number];
