import React from 'react';
import {withProvider} from './AppContext';
import './App.css'

const ScoreDisplay = (props) => {
    console.log(props);
    return (
        <div className='text-center'>
            <h1>Username: <span className='text-success'>{props.username}</span></h1>
            <h1>Score: <span className='text-info'>{props.score}</span></h1>
            <button onClick={() => props.deleteScores(props.id)}>Delete</button>
        </div>
    )
}

export default withProvider(ScoreDisplay);