import type { MetadataRoute } from "next";

/** Manifeste PWA : permet d'installer PlugStudy sur le téléphone ou l'ordinateur. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "PlugStudy",
    short_name: "PlugStudy",
    description: "PlugStudy lit tes cours et te dit quoi réviser en premier.",
    lang: "fr",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#03833d",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
