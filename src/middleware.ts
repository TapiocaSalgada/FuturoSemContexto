import { withAuth } from "next-auth/middleware"

export default withAuth({
  pages: {
    signIn: "/login",
  },
})

export const config = {
  matcher: [
    "/((?!api/auth|api/watch/proxy|login|register|_next/static|_next/image|favicon.ico|manifest.json|site.webmanifest|sw.js|.*\\..*).*)",
  ],
}
