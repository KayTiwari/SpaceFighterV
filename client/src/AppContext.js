import React, { Component } from "react";
import axios from "axios";

const todoAxios = axios.create();

todoAxios.interceptors.request.use(config => {
    const token = localStorage.getItem('token')
    config.headers.Authorization = `Bearer ${token}`
    return config
})

const AppContext = React.createContext();

export class AppContextProvider extends Component {
    constructor() {
        super()
        this.state = {
            score: [],
            user: JSON.parse(localStorage.getItem('user')) || {},
            token: localStorage.getItem('token') || ''
        }
    }

    signup = userInfo => {
        return axios.post('/auth/signup', userInfo)
            .then(response => {
                const { user, token } = response.data
                localStorage.setItem('user', user)
                localStorage.setItem('token', token)
                this.setState({
                    user,
                    token
                })
                return response
            })
        }

    login = credentials => {
        return axios.post('/auth/login', credentials)
            .then(response => {
                const {token, user} = response.data
                localStorage.setItem('user', JSON.stringify(user))
                localStorage.setItem('token', token)
                this.setState({
                    user,
                    token
                })
                return response;
            })
    }

    logout = () => {
        localStorage.removeItem("user");
        localStorage.removeItem("token");
        this.setState({
            scores: [],
            user: {},
            token: ""
        })
    }

    

    getScores = () => {
        todoAxios.get("/api/scores")
            .then(response => {
                this.setState({ score: response.data });
                console.log(response.data);
                return response;
            })
    }

    postScores = (newScore) => {
        return todoAxios.post("/api/scores/", newScore)
            .then(response => {
                this.setState(prevState => {
                    return { score: [...prevState.score, response.data] }
                });
                return response;
            })
    }


    deleteScores = id => {
        todoAxios.delete(`/api/scores/${id}`).then(response => {
            console.log(id);
            this.setState(prevState => ({
                score: prevState.score.filter(score => score._id !== id)
            }))
        })
    }

    render() {
        return (
            <AppContext.Provider
                value={{
                    getScores: this.getScores,
                    postScores: this.postScores,
                    deleteScores: this.deleteScores,
                    signup: this.signup,
                    login: this.login,
                    logout: this.logout,
                    ...this.state
                }}
            >

                {this.props.children}

            </AppContext.Provider>
        )
    }
}


export const withProvider = Component => {
    return props => {
        return (
            <AppContext.Consumer>
                {
                    globalState => {
                        return (
                            <Component
                                {...globalState}
                                {...props}
                            />
                        )
                    }
                }
            </AppContext.Consumer>
        )
    }
}