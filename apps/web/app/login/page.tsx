import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { signIn } from "@/lib/auth";

export default function LoginPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  return (
    <main style={{ maxWidth: 360, margin: "4rem auto", fontFamily: "sans-serif" }}>
      <h1>DDN Portal</h1>
      {searchParams.error && (
        <p style={{ color: "crimson" }}>Incorrect email or password.</p>
      )}
      <form
        action={async (formData) => {
          "use server";
          try {
            await signIn("credentials", {
              email: formData.get("email"),
              password: formData.get("password"),
              redirectTo: "/",
            });
          } catch (err) {
            // A successful signIn() throws Next's internal NEXT_REDIRECT
            // (via redirectTo) -- that, and anything that isn't a
            // Credentials rejection, must propagate unchanged. Only an
            // AuthError becomes the inline message above.
            if (err instanceof AuthError) {
              redirect("/login?error=1");
            }
            throw err;
          }
        }}
      >
        <label>
          Email
          <input type="email" name="email" required style={{ display: "block", width: "100%" }} />
        </label>
        <label style={{ display: "block", marginTop: "0.75rem" }}>
          Password
          <input
            type="password"
            name="password"
            required
            style={{ display: "block", width: "100%" }}
          />
        </label>
        <button type="submit" style={{ marginTop: "1rem" }}>
          Sign in
        </button>
      </form>
    </main>
  );
}
