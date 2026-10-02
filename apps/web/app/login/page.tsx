import { signIn } from "@/lib/auth";

export default function LoginPage() {
  return (
    <main style={{ maxWidth: 360, margin: "4rem auto", fontFamily: "sans-serif" }}>
      <h1>DDN Portal</h1>
      <form
        action={async (formData) => {
          "use server";
          await signIn("email", { email: formData.get("email") });
        }}
      >
        <label>
          Email
          <input type="email" name="email" required style={{ display: "block", width: "100%" }} />
        </label>
        <button type="submit" style={{ marginTop: "1rem" }}>
          Send magic link
        </button>
      </form>
    </main>
  );
}
