import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { adminClient, anonClient, cleanup, createTestUser } from "./setup";

describe("soft delete excludes from active list", () => {
  beforeAll(cleanup);
  afterAll(cleanup);

  it("editor soft-deletes; row leaves active filter but restore brings it back", async () => {
    const admin = adminClient();
    const master = await createTestUser();
    const editor = await createTestUser();
    const { data: group } = await admin
      .from("groups")
      .insert({ name: "R", join_code: "SDEL0001", created_by: master.userId })
      .select("id")
      .single();
    await admin.from("memberships").insert([
      { group_id: group!.id, user_id: master.userId, role: "master", status: "active" },
      { group_id: group!.id, user_id: editor.userId, role: "editor", status: "active" },
    ]);
    const asEditor = anonClient(editor.accessToken);
    const { data: s } = await asEditor
      .from("students")
      .insert({ group_id: group!.id, name: "지울학생", grade: 3 })
      .select("id")
      .single();

    await asEditor.from("students").update({ deleted_at: new Date().toISOString() }).eq("id", s!.id);
    const active = await asEditor.from("students").select("id").is("deleted_at", null);
    expect(active.data?.find((r) => r.id === s!.id)).toBeUndefined();

    await asEditor.from("students").update({ deleted_at: null }).eq("id", s!.id);
    const activeAgain = await asEditor.from("students").select("id").is("deleted_at", null);
    expect(activeAgain.data?.find((r) => r.id === s!.id)).toBeTruthy();
  });
});
