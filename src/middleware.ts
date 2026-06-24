export { default } from "next-auth/middleware";

export const config = {
  matcher: ["/dashboard/:path*", "/calendar/:path*", "/analytics/:path*", "/reflections/:path*"],
};
