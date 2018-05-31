import React, { Component } from 'react'
import { Provider } from 'mobx-react'

import stores from './stores'
import Calendar from './components/Calendar'
import Legend from './components/Legend'
import SearchForm from './components/SearchForm'

import './App.css'

class App extends Component {
  render () {
    return (
      <Provider {...stores}>
        <div className='grid'>
          <SearchForm />
          <Legend />
          <Calendar />
        </div>
      </Provider>
    )
  }
}

export default App
