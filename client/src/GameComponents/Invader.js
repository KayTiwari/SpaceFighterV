import React, {Component} from 'react';
import Bullet from './Bullet';

export const Direction = {
    Left: 0,
    Right: 1
}

class Invader extends Component {
    constructor(args){
        super();

        this.state = {

        }
        this.direction = Direction.Right;
        this.position = args.position;
        this.speed = args.speed;
        this.radius = args.radius;
        this.delete = false;
        this.onDie = args.onDie
        this.bullets = [];
        this.lastShot = 0;
    }
    reverse = () => {
        if (this.direction === Direction.Right){
            this.position.x -= 10;
            this.direction = Direction.Left;
        } else {
            this.direction = Direction.Right;
            this.position.x += 10;
        }
    }

    update = () => {
        if (this.direction === Direction.Right) {
            this.position.x += this.speed;
        } else {
            this.position.x -= this.speed;
        }
        let nextShot = Math.random() * 500;
        if (Date.now() - this.lastShot > 250 * nextShot) {
            const bullet = new Bullet ({
                position: {x: this.position.x, y: this.position.y - 5},
                speed: 2.5,
                radius: 15,
                direction: "down"
            })
            this.bullets.push(bullet);
            this.lastShot = Date.now();
        }
    }
    renderBullets(state) {
        let index = 0;
        for(let bullet of this.bullets) {
            if (bullet.delete) {
                this.bullets.splice(index, 1);
                // console.log('hi')
            } else {
                this.bullets[index].update();
                this.bullets[index].render(state);
            }
            index++;
        }
    }

    die = () => {
        this.delete = true;
        // this.onDie();
    }

    render(state) {
        const context = state.context;
        this.renderBullets(state);
        context.save();
        context.translate(this.position.x, this.position.y);
        context.strokeStyle = '#FFFF00';
        context.fillStyle = '#FFBD4A';
        context.lineWidth = 2;
        context.beginPath();
        context.moveTo(-5, 25);
        context.lineTo(5, 25);
        context.lineTo(-5, 0);
        context.lineTo(15, 15);
        context.lineTo(15, -15);
        context.lineTo(-15, -15);
        context.lineTo(-15, 15);
        context.lineTo(5, 0);
        context.closePath();
        context.fill();
        context.stroke();
        context.restore();
        return (
            <div></div>
        )
    }
}
export default Invader