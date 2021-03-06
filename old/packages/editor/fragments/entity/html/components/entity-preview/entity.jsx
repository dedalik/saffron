import React from 'react';
import ReactDOM from 'react-dom';
import { clone } from 'common/utils/object';
import EntityPreview from './entity-preview';

function convertStyle(style) {
  var converted = {};
  for (var key in style) {
    var v = style[key];
    if (/left|top|margin|width|height/.test(key) && !isNaN(v)) {
      v = v + 'px';
    }
    converted[key] = v;
  }
  return converted;
}

class BaseNode {
  constructor(entity, element) {
    this.entity  = entity;
    this.element = element;
    this.preview = entity.preview = new EntityPreview(entity, this);
    entity.notifier.push(this);
    this.attributes = {};
  }

  notify(message) {
    this.invalidateCache();
  }

  invalidateCache() {
    this.preview.invalidateCache();
  }

  dispose() {
    this.entity.notifier.remove(this);
  }
}

class ElementNode extends BaseNode {
  constructor(entity, element) {
    super(entity, element || document.createElement(entity.tagName));
    this._addChildren();
    this._updateAttributes();
  }

  invalidateCache() {
    super.invalidateCache();
    this._children.forEach((child) => {
      child.invalidateCache();
    });
  }

  notify(message) {
    super.notify(message);
    this._updateAttributes();

    if (message.changes)
    for (var change of message.changes) {
      if (change.target === this.entity.children) {
        this._updateChildren(change);
      }
    }
  }

  dispose() {
    super.dispose();
    this._children.forEach(function(child) {
      child.dispose();
    })
  }

  _updateChildren(change) {
    // TODO
    change.removed.forEach((entity) => {
      for (var i = this._children.length; i--;) {
        var child = this._children[i];
        if (child.entity === entity) {
          this._children.splice(i, 1);
          child.dispose();

          // contains(element) might be false when using content editable against element
          if (this.element.contains(child.element)) {
            this.element.removeChild(child.element);
          }
        }
      }
    });

    change.added.forEach((entity) => {
      var i = this.entity.children.indexOf(entity);
      var child = createElement(entity);
      this._children.splice(i, 0, child);
      if (i === this.entity.children.length - 1) {
        this.element.appendChild(child.element);
      } else {
        this.element.insertBefore(child.element, this.element.childNodes[i + 1]);
      }
    });
  }

  _addChildren() {
    (this._children = this.entity.children.map(createElement)).forEach((child) => {
      this.element.appendChild(child.element);
    });
  }

  _updateAttributes() {
    var attribs = this.entity.attributes;

    for (var key in attribs) {
      var value = attribs[key];
      if (key === 'style') {

        // todo - this is less optimal, but ensures that the element style is always in sync with the entity style
        this.element.setAttribute('style', '');
        Object.assign(this.element.style, convertStyle(value));

      // dirty caching here of attributes
      } else if (this.attributes[key] !== value) {
        this.element.setAttribute(key, this.attributes[key] = value);
      }
    }
  }
}

class TextNode extends BaseNode {
  constructor(entity) {

    // note that span is required here instead of createTextNode
    super(entity, document.createElement('span'));
    this._updateText();
  }

  notify(message) {
    super.notify(message);
    this._updateText();
  }

  _updateText() {
    this.element.textContent = this.entity.value;
  }
}

function createElement(entity) {
  if (entity.componentType === 'element') {
    return new ElementNode(entity);
  } else {
    return new TextNode(entity);
  }
}
class HTMLEntityRootComponent extends React.Component {

  componentDidMount() {
    var placeholder = this.refs.placeholder;

    var doc = placeholder.contentWindow.document;
    doc.body.style.padding = doc.body.style.margin = '0px';
    var div = this.div = document.createElement('div');
    doc.body.appendChild(div);
    this._render(this.props);
  }

  componentWillReceiveProps(props) {
    this._render(props);
  }

  _render(props) {
    var div = this.div;

    if (!this.root || this.props.entity !== props.entity) {

      this._cleanup();
      this.root = createElement(props.entity);
      div.appendChild(this.root.element);
    }

    div.style.zoom = this.props.app.preview.zoom;
    this.root.invalidateCache();
  }

  componentWillUnmount() {
    this._cleanup();
  }

  _cleanup() {
    if (this.root) {
      this.div.removeChild(this.root.element);
      this.root.dispose();
      this.root = void 0;
    }
  }

  render() {
    var style = {
      border: 'none',
      width: '100%',
      height: '100%'
    };

    return <iframe ref='placeholder' style={style}>

    </iframe>;
  }
}

export default HTMLEntityRootComponent;
