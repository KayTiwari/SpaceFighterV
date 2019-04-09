import React, {Component} from 'react';
import { Link } from 'react-router-dom';
import {withProvider} from './AppContext';
import ScoreDisplay from './ScoreDisplay';
import './App.css'



class ScorePage extends Component{
    constructor(){
        super();

        this.state = {

        }
    }
    componentDidMount() {
        this.props.getScores()
        }
    render(props) {
        console.log(this.props);
        let mappedScores = this.props.score && this.props.score.map((item) =>{return (<ScoreDisplay username={item.username} score={item.score} id={item._id} />)})
        return (
        <div className='bg-light'>
            <h1 className='text-center mt-0'>Scores</h1>
            <div>{mappedScores}</div>
            <Link to='/SpaceFighterComputer'><button className='btn btn-lg btn-muted btn-block' type="submit">Play Again?</button></Link>
            <Link to='/' onClick={this.props.logout}><button id='exit' className='btn btn-lg btn-dark btn-block' type="submit">Logout</button></Link> 
        </div>
        )
    }
}
export default withProvider(ScorePage);