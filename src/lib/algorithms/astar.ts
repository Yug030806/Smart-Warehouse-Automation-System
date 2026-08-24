import { RouteSegment } from '../database.types';

// Standard simple node definition for A* Algorithm
interface AStarNode {
  x: number;
  y: number;
  floorId: string;
  g: number;
  h: number;
  f: number;
  parent: AStarNode | null;
}

// Calculate route on 2D grid taking obstacles into account
// Multi-floor paths transition automatically via elevators (coordinates [10, 4])
export function calculateRoute(
  startFloorId: string,
  startX: number,
  startY: number,
  targetFloorId: string,
  targetX: number,
  targetY: number,
  allLocations: any[], // To determine layout types and positions
  gridWidth = 12,
  gridHeight = 8
): RouteSegment[] {
  
  // If start floor is different from target floor, we must route:
  // start -> start floor elevator [10, 4] -> transition floor -> target floor elevator [10, 4] -> target location
  if (startFloorId !== targetFloorId) {
    const startElevator = allLocations.find(l => l.floor_id === startFloorId && l.type === 'ELEVATOR');
    const targetElevator = allLocations.find(l => l.floor_id === targetFloorId && l.type === 'ELEVATOR');
    
    const elevX = startElevator ? startElevator.x : 10;
    const elevY = startElevator ? startElevator.y : 4;

    const segment1 = solveSingleFloor(startFloorId, startX, startY, elevX, elevY, allLocations, gridWidth, gridHeight);
    
    // Elevator exit event
    const transitSegment: RouteSegment = {
      floor_id: targetFloorId,
      x: elevX,
      y: elevY,
      action: 'ELEVATOR_EXIT'
    };
    
    const segment2 = solveSingleFloor(targetFloorId, elevX, elevY, targetX, targetY, allLocations, gridWidth, gridHeight);
    
    // Add actions
    if (segment1.length > 0) {
      segment1[segment1.length - 1].action = 'ELEVATOR_ENTER';
    }
    
    return [...segment1, transitSegment, ...segment2];
  }

  return solveSingleFloor(startFloorId, startX, startY, targetX, targetY, allLocations, gridWidth, gridHeight);
}

function solveSingleFloor(
  floorId: string,
  sx: number,
  sy: number,
  tx: number,
  ty: number,
  allLocations: any[],
  gridWidth: number,
  gridHeight: number
): RouteSegment[] {
  // Identify blocked coordinates (e.g. racks other than target, walls, etc.)
  const obstacles = new Set<string>();
  allLocations.forEach(loc => {
    // If it's on this floor, and it's a RACK or ELEVATOR (and NOT our destination or start)
    if (loc.floor_id === floorId) {
      const isTarget = loc.x === tx && loc.y === ty;
      const isStart = loc.x === sx && loc.y === sy;
      if (loc.type === 'RACK' && !isTarget && !isStart) {
        obstacles.add(`${loc.x},${loc.y}`);
      }
    }
  });

  const openList: AStarNode[] = [];
  const closedList: AStarNode[] = [];

  const startNode: AStarNode = {
    x: sx,
    y: sy,
    floorId,
    g: 0,
    h: Math.abs(sx - tx) + Math.abs(sy - ty),
    f: 0,
    parent: null
  };
  startNode.f = startNode.g + startNode.h;
  openList.push(startNode);

  while (openList.length > 0) {
    // Get node with lowest f score
    openList.sort((a, b) => a.f - b.f);
    const current = openList.shift()!;
    closedList.push(current);

    // Found the target
    if (current.x === tx && current.y === ty) {
      const path: RouteSegment[] = [];
      let temp: AStarNode | null = current;
      while (temp !== null) {
        path.unshift({
          floor_id: floorId,
          x: temp.x,
          y: temp.y,
          action: 'MOVE'
        });
        temp = temp.parent;
      }
      return path;
    }

    // Neighbors (orthogonal movement)
    const dirs = [
      { dx: 0, dy: -1 },
      { dx: 0, dy: 1 },
      { dx: -1, dy: 0 },
      { dx: 1, dy: 0 }
    ];

    for (const d of dirs) {
      const nx = current.x + d.dx;
      const ny = current.y + d.dy;

      // Grid bounds verification
      if (nx < 0 || nx >= gridWidth || ny < 0 || ny >= gridHeight) continue;

      // Obstacle verification
      if (obstacles.has(`${nx},${ny}`)) continue;

      // Closed list check
      if (closedList.some(node => node.x === nx && node.y === ny)) continue;

      const gScore = current.g + 1;
      const hScore = Math.abs(nx - tx) + Math.abs(ny - ty);
      const fScore = gScore + hScore;

      const existingOpen = openList.find(node => node.x === nx && node.y === ny);

      if (!existingOpen) {
        openList.push({
          x: nx,
          y: ny,
          floorId,
          g: gScore,
          h: hScore,
          f: fScore,
          parent: current
        });
      } else if (gScore < existingOpen.g) {
        existingOpen.g = gScore;
        existingOpen.f = fScore;
        existingOpen.parent = current;
      }
    }
  }

  // Fallback direct path if grid search failed due to blocks
  const directPath: RouteSegment[] = [];
  let cx = sx;
  let cy = sy;
  while (cx !== tx || cy !== ty) {
    directPath.push({ floor_id: floorId, x: cx, y: cy, action: 'MOVE' });
    if (cx < tx) cx++;
    else if (cx > tx) cx--;
    else if (cy < ty) cy++;
    else if (cy > ty) cy--;
  }
  directPath.push({ floor_id: floorId, x: tx, y: ty, action: 'MOVE' });
  return directPath;
}
