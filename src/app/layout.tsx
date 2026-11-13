import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Forma PDF | Editor de documentos",
  description: "Edite textos, valores e elementos dos seus PDFs em um espaço de trabalho simples e profissional."
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body>{children}</body></html>;
}