import React from 'react';
import { Link } from 'react-router-dom'
import Title from './Title';
import {withProvider} from './AppContext'
import './App.css'

const Main = (props) => {
    console.log(localStorage);
    return (
        <div className='bg-light'>
            <h1 className='text-center mt-0'>Choose a game</h1>
        <Link to='/SpaceFighterSelect'><button className='btn btn-lg btn-muted btn-block' type="submit"><Title /></button></Link>
        {/* <Link to='/PongSelect'><button  className='btn btn-lg btn-muted btn-block mb-5' type="submit">OG PONG</button></Link> */}
        {localStorage.token ? <Link to='/' onClick={props.logout}><button id='exit' className='btn btn-lg btn-dark btn-block' type="submit">Logout</button></Link> : <Link to='/' onClick={props.logout}><button id='exit' className='btn btn-lg btn-dark btn-block' type="submit">Exit</button></Link> }
        </div>
    )
}

export default withProvider(Main);