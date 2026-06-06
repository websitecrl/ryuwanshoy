import { userAgent } from "next/server";
import sitemap from "./sitemap";

export default function robots() {
    return {
        rules: [
            {
                userAgent: '*',
                allow: '/',
                disallow: [
                    '/admin',
                    '/admin/',
                    '/api/',
                ],
            },
        ],
       sitemap: `${process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryuwanshoy.com'}/sitemap.xml`,
    }
}