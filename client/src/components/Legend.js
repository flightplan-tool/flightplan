import React, { Component } from 'react'
import { inject, observer } from 'mobx-react'

import './Legend.css'
import theme from './theme.json'

@inject('searchStore')
@observer
class Legend extends Component {
  render () {
    const { legend, showWaitlisted } = this.props.searchStore

    if (legend.length === 0) {
      return null
    }

    return (
      <div className='legend'>
        {legend.map(section => (
          this.renderSection(section, showWaitlisted)
        ))}
      </div>
    )
  }

  renderSection (section, showWaitlisted) {
    const { key, name, fares } = section

    const elements = []
    for (const code of fares) {
      const { key, name, index, waitlisted } = code
      const palette = waitlisted ? theme.awardWaitlisted : theme.award
      const color = palette[index % palette.length].fillColor
      elements.push(<div key={key + '-swatch'} className='swatch' style={{ backgroundColor: color }} />)
      elements.push(<p key={key + '-lbl'} className={showWaitlisted ? 'short' : 'wide'}>{name}</p>)
    }

    return (
      <section key={key}>
        <h2>{name}</h2>
        {elements}
      </section>
    )
  }
}

export default Legend
