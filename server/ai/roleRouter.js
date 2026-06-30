const ROLE_LOADERS = {
  cabbage: async () => (await import("./prompts/roles/cabbage.zh.js")).cabbageRole,
  pig: async () => (await import("./prompts/roles/pig.zh.js")).pigRole,
  pigKing: async () => (await import("./prompts/roles/pigKing.zh.js")).pigKingRole,
};

export async function getRoleConfig(speakerType) {
  const loadRole = ROLE_LOADERS[speakerType];
  if (!loadRole) {
    throw new Error(`Unsupported speakerType: ${speakerType}`);
  }
  return loadRole();
}

export function hasRoleConfig(speakerType) {
  return Boolean(ROLE_LOADERS[speakerType]);
}
