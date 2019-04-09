import React, {Component} from 'react';
import {withProvider} from './AppContext';
import {Link} from 'react-router-dom';
import './App.css';

class Register extends Component {
    constructor() {
        super();

        this.state={
            username: '',
            password: ''
        }
    }
    clearInputs = () => {
        this.setState({
            username: "",
            password: ""
        })
    }
    handleChange = (event) => {
        this.setState({
            [event.target.name]: event.target.value
        })
    }
    handleRegister = (e) => {
        e.preventDefault();
        this.props.signup(this.state)
        .then(() => this.props.history.push('/'));
        alert('Account successfully created!')
        alert(JSON.stringify(this.state));
        this.clearInputs();
    }

    render() {
        return(
            <div className='text-center bg-light'>
                <h1 className="h3 mb-3 font-weight-normal mt-5">Create your account</h1>
                <div className='d-inline-block'>
                <label for="inputUser" className="sr-only">Username</label>
                <input onChange={this.handleChange} type='text' id="inputUsername" className='form-group' name='username' placeholder='Username' required autoFocus></input>
                <div>
                <label for="inputPass" className="sr-only">Password</label>
                <input onChange={this.handleChange} type='password' id="inputPassword" className='form-group' name='password' placeholder='Password' required></input>
                </div>
                <button onClick={this.handleRegister} className='btn btn-lg btn-info btn-block' type="submit">Create Account</button>
                <Link to='/'><button onClick={this.handleSubmit} className='btn btn-lg btn-muted btn-block' type="submit">Go Back</button></Link>
                </div>
            </div>
        )
    }
}
export default withProvider(Register);