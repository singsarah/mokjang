import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { adminClient, anonClient, cleanup, createTestUser } from "./setup";

describe("RLS: cross-group isolation", () => {
  beforeAll(cleanup);
  afterAll(cleanup);

  it("user in group A cannot read group B's rows", async () => {
    const admin = adminClient();
    const userA = await createTestUser();
    const userB = await createTestUser();

    const { data: groupA } = await admin
      .from("groups")
      .insert({ name: "A", join_code: "AAAA1111", created_by: userA.userId })
      .select()
      .single();
    const { data: groupB } = await admin
      .from("groups")
      .insert({ name: "B", join_code: "BBBB2222", created_by: userB.userId })
      .select()
      .single();

    await admin.from("memberships").insert([
      { group_id: groupA!.id, user_id: userA.userId, role: "master", status: "active" },
      { group_id: groupB!.id, user_id: userB.userId, role: "master", status: "active" },
    ]);

    // userA queries groups — should only see A
    const asUserA = anonClient(userA.accessToken);
    const { data: visibleToA } = await asUserA.from("groups").select("id, name");
    expect(visibleToA?.map((g) => g.name).sort()).toEqual(["A"]);

    // userA queries memberships — should only see own group's
    const { data: membershipsA } = await asUserA
      .from("memberships")
      .select("group_id");
    expect(membershipsA?.every((m) => m.group_id === groupA!.id)).toBe(true);
  });

  it("viewer cannot update groups (role guard)", async () => {
    const admin = adminClient();
    const user = await createTestUser();

    const { data: group } = await admin
      .from("groups")
      .insert({ name: "V", join_code: "VVVV9999", created_by: user.userId })
      .select()
      .single();
    await admin.from("memberships").insert({
      group_id: group!.id,
      user_id: user.userId,
      role: "viewer",
      status: "active",
    });

    const asUser = anonClient(user.accessToken);
    await asUser.from("groups").update({ name: "renamed" }).eq("id", group!.id);

    // RLS returns 0 rows (silent block) OR error — both are acceptable pass paths.
    const { data: after } = await admin
      .from("groups")
      .select("name")
      .eq("id", group!.id)
      .single();
    expect(after?.name).toBe("V");
  });

  it("pending members cannot read group data", async () => {
    const admin = adminClient();
    const master = await createTestUser();
    const pending = await createTestUser();

    const { data: group } = await admin
      .from("groups")
      .insert({ name: "P", join_code: "PPPP3333", created_by: master.userId })
      .select()
      .single();
    await admin.from("memberships").insert([
      { group_id: group!.id, user_id: master.userId, role: "master", status: "active" },
      { group_id: group!.id, user_id: pending.userId, role: "viewer", status: "pending" },
    ]);

    const asPending = anonClient(pending.accessToken);
    const { data: visible } = await asPending.from("groups").select("id");
    expect(visible ?? []).toEqual([]);
  });
});
