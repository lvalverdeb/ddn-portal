export const metadata = {
  title: "DDN Portal",
  description: "Customer data-upload portal for DDN deployments",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
