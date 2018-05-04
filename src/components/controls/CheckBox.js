import React from 'react'
import './CheckBox.css'

export default (props) => {
  const {
    checked = false,
    children,
    className = '',
    label = '',
    name,
    style,
    onChange
  } = props

  const labelProps = { className: 'checkbox' }
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
        type='checkbox'
        name={name}
        checked={checked}
        onChange={(e) => (onChange && onChange(e))}
      />
      <span className='checkmark' />
    </label>
  )
}
