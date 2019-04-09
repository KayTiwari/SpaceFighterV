import React from 'react';
import {Route, Link, Switch} from 'react-router-dom';
import Title from './Title';
import Login from './Login';
import Main from './Main';
import Register from './Register';
import SpaceFighterSelect from './SpaceFighterSelect'
import SpaceFighterComputer from './SpaceFighterComputer'
import ScorePage from './ScorePage';

const App = () => {
    return (
        <div>
             {/* <Title /> */}
            <Switch>
            <Route exact path='/' component={Login}/>
            <Route exact path='/Main' component={Main}/>
            <Route exact path='/Register' component={Register}/>
            <Route exact path='/SpaceFighterSelect' component={SpaceFighterSelect}></Route>
            <Route exact path='/SpaceFighterComputer' component={SpaceFighterComputer}></Route>
            <Route exact path='/ScorePage' component={ScorePage}></Route>
            </Switch>
        </div>
    )
}
export default App;