import React, {Component} from 'react';
import {Link} from 'react-router-dom';
import {withProvider} from './AppContext'
import Title from './Title'
// import './App.css';


class Login extends Component {
        constructor() {
            super();

            this.state = {
                username: '',
                password: ''
            }
        }
    
    handleChange = (event) => {
        this.setState({
            [event.target.name]: event.target.value
        })
    }
    handleSubmit = (e) => {
        e.preventDefault();
        this.props.login(this.state)
        .then(() => this.props.history.push("/Main"))
        .then(() => alert('Login successful!'))
    }


    render() {
    return (
        <div><Title />
    <body className='text-center bg-light'>
    <form className='form-signin form-group'>
    <h1 className="h3 mb-3 font-weight-normal mt-5">Login or Sign-up</h1>
    <div className='d-inline-block'>
    <label for="inputUser" className="sr-only">Username</label>
    <input onChange={this.handleChange} type='text' id="inputUsername" className='form-group' name='username' placeholder='Username' required autoFocus></input>
    <div>
    <label for="inputPass" className="sr-only">Password</label>
    <input onChange={this.handleChange} type='password' id="inputPassword" className='form-group' name='password' placeholder='Password' required></input>
    </div>
        <div className='center'>
    <button onClick={this.handleSubmit} className='btn btn-lg btn-primary btn-block' type="submit">Log in</button>
    <Link to='/Register'><button className='btn btn-lg btn-success btn-block mt-1' type="submit">Register</button></Link>
    <Link to='/Main'><button className='btn btn-lg btn-secondary btn-block mt-5' type="submit">Just Play</button></Link>
    </div>
    </div>
    </form>
    </body>
    </div>
    )
}
}

export default withProvider(Login);