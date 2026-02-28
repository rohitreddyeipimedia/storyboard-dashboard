export const metadata = {
  title: "Storyboard Dashboard",
  description: "Script to Shotlist to Storyboard PPTX",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
