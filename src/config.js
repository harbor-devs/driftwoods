// All the numbers you might want to tweak, in one place

export const DRIFT_SPEED = 2; // how fast the world flows past the raft
export const HOOK_SPEED = 22; // how fast the hook flies out
export const HOOK_RANGE = 14; // how far you can throw
export const CATCH_RADIUS = 1.4; // how close the hook must get to grab something
export const TILE_SIZE = 2; // size of one raft tile
export const TILE_COST = 3; // planks needed for one new tile
export const JOURNEY_TIME = 180; // seconds to reach the island

// Steering
export const STEER_ACCEL = 14; // how fast the raft speeds up sideways
export const STEER_MAX_SPEED = 6; // top sideways speed (for the starting 2x2 raft)
export const STEER_DRAG = 2.5; // how fast it slows down when you let go
export const SIZE_SLOWDOWN = 0.08; // each extra tile makes steering this much slower
export const WORLD_LIMIT = 40; // how far left or right you can go