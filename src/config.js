// All the numbers you might want to tweak, in one place

export const DRIFT_SPEED = 2; // how fast the world flows past the raft
export const HOOK_SPEED = 22; // how fast the hook flies out
export const HOOK_RANGE = 14; // how far you can throw
export const CATCH_RADIUS = 1.4; // how close the hook must get to grab something
export const TILE_SIZE = 2; // size of one raft tile
export const TILE_COST = 3; // planks needed for one new tile
export const JOURNEY_TIME = 180; // seconds to reach the island

// Build menu items
export const NET_PLANKS = 4; // planks for one catch net
export const NET_ROPE = 2; // rope for one catch net
export const NET_REACH = 1.8; // how close floating stuff must get to the net to be caught

export const SPIKE_PLANKS = 3; // planks for one set of spikes
export const SPIKE_ROPE = 1; // rope for one set of spikes
export const SPIKE_HITS = 3; // how many shark attacks spikes take before they break

export const SAIL_PLANKS = 6; // planks for one sail
export const SAIL_ROPE = 3; // rope for one sail
export const SAIL_BOOST = 0.3; // each sail makes the raft this much faster (0.3 = 30%)
export const MAX_SAILS = 3; // you can't build more than this

// Raft steering (from the character leaning)
export const STEER_ACCEL = 14; // how hard leaning pushes the raft
export const STEER_MAX_SPEED = 6; // top speed (for the starting 2x2 raft)
export const STEER_DRAG = 2.5; // how fast it slows down
export const SIZE_SLOWDOWN = 0.08; // each extra tile makes the raft this much slower and heavier
export const LEAN_DEADZONE = 0.15; // stand near the middle and the raft doesn't drift
export const WORLD_LIMIT = 40; // how far left or right you can go
export const FORWARD_LIMIT = 10; // how far forward (up the screen) you can go
export const BACK_LIMIT = 6; // how far back (down the screen) you can go

// Character
export const WALK_SPEED = 3.5; // top walking speed
export const WALK_ACCEL = 10; // how snappy starting and stopping feels
export const CHAR_RADIUS = 0.3; // how close to the edge he can stand