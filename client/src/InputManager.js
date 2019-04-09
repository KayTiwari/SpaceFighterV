import React, {Component} from 'react';


const KEY = {
    LEFT: 37,
    RIGHT: 39,
    UP: 38,
    DOWN: 40,
    SPACE: 32,
    ENTER: 13,
    S: 83
}

class InputManager extends Component{
    constructor(){
        super();

        this.pressedKeys = {
            left: 0,
            right: 0,
            up: 0,
            down: 0,
            space: 0,
            enter: 0
        }
    }
    bindKeys = () => {
        window.addEventListener('keyup', this.handleKeys.bind(this, false));
        window.addEventListener('keydown', this.handleKeys.bind(this, true));
    }

    unbindKeys = () => {
        window.removeEventListener('keyup', this.handleKeys);
        window.removeEventListener('keydown', this.handleKeys);
    }

    handleKeys = (value, e) => {
        let keys = this.pressedKeys;
        switch(e.keyCode) {
            case KEY.LEFT:
                keys.left = value;
                break;
            case KEY.RIGHT:
                keys.right = value;
                break;
            case KEY.SPACE:
                keys.space = value;
                break;
            case KEY.ENTER:
                keys.enter = value;
                break;
            case KEY.S:
                keys.S = value;
                break;
        }
        this.pressedKeys = keys;
    }
}

export default InputManager;