export interface SkillOption {
  id: number;
  name: string;
  type: 'Skill';
}

export class SkillOptionsContractError extends Error {
  readonly code = 'INVALID_RESPONSE';
  readonly kind = 'response';
  constructor() {
    super('Danh sách kỹ năng trả về không hợp lệ.');
    this.name = 'SkillOptionsContractError';
  }
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function parseSkillOptions(value: unknown): SkillOption[] {
  if (!record(value) || !Array.isArray(value.items))
    throw new SkillOptionsContractError();
  const ids = new Set<number>();
  return value.items.map((item: unknown) => {
    if (
      !record(item) ||
      typeof item.id !== 'number' ||
      !Number.isInteger(item.id) ||
      item.id < 1 ||
      item.id > 2_147_483_647 ||
      ids.has(item.id) ||
      typeof item.name !== 'string' ||
      !item.name.trim() ||
      Array.from(item.name).length > 100 ||
      item.type !== 'Skill' ||
      Object.hasOwn(item, 'status')
    )
      throw new SkillOptionsContractError();
    ids.add(item.id);
    return { id: item.id, name: item.name, type: 'Skill' };
  });
}
