import React from 'react';
import {Link} from 'react-router-dom'

const PongSelect = (props) => {
    return (
        <div className='text-center'>
    <div className='d-inline-block'>
            <h1 className='text-center mt-0'>Select Game Mode</h1>
        <Link to='/SpaceFighterComputer'><button className='btn btn-lg btn-info btn-block mt-5 mb-5' type="submit">Click here to play!</button></Link>
        <Link to='/'><button  className='btn btn-lg btn-success btn-block mb-5 mt-5' type="submit">2 Player</button></Link>
        {localStorage.token ? <Link to='/' onClick={props.logout}><button id='exit' className='btn btn-lg btn-dark btn-block' type="submit">Logout</button></Link> : <Link to='/' onClick={props.logout}><button id='exit' className='btn btn-lg btn-dark btn-block' type="submit">Exit</button></Link> }
        <Link to='/Main'><button className='btn btn-lg btn-muted btn-block'>Go Back</button></Link>
        </div>
        </div>
    )
}

export default PongSelect