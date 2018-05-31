import React from 'react'
import './RadioButton.css'

export default (props) => {
  const {
    checked = false,
    children,
    className = '',
    label = '',
    name,
    style,
    value,
    onChange
  } = props

  const labelProps = { className: 'radiobutton' }
  if (className) {
    labelProps.className += ' ' + className
  }
  if (style) {
    labelProps.style = style
  }

  return (
    <label {...labelProps}>
      {label}{children}
      <input
        type='radio'
        name={name}
        checked={checked}
        value={value}
        onChange={(e) => (onChange && onChange(e))}
      />
      <span className='radiomark' />
    </label>
  )
}
