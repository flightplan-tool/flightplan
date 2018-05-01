import React, { Component } from 'react'
import { Provider } from 'mobx-react'

import stores from './stores'
import Calendar from './components/Calendar'

import './App.css'

class App extends Component {
  render () {
    return (
      <Provider {...stores}>
        <Calendar />
      </Provider>
    )
  }
}

export default App
