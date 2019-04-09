

export function checkCollisionsFor(items1, items2) {
    let a = items1.length - 1;
    let b;
    for (a; a > -1; --a) {
        b = items2.length - 1;
        for(b; b > -1; --b) {
            let item1 = items1[a];
            let item2 = items2[b];
            if (checkCollisions(item1, item2)) {
                item1.die();
                item2.die();
                // console.log('collision occurred')
            }
        }
    }
}

export function checkCollisions(obj1, obj2) {
    var vx = obj1.position.x - obj2.position.x;
    var vy = obj1.position.y - obj2.position.y;
    var ED = Math.sqrt(vx * vx + vy * vy);
    if (ED + 10 <= obj1.radius + obj2.radius) {
        // console.log('fired')
        return true;
    }
    return false;
}