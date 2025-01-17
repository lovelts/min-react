
// https://github.com/facebook/react/blob/603e6108f39c6663ec703eed34a89ff1bf0cb70c/packages/react-reconciler/src/ReactFiberRootScheduler.js#L42

let nextUnitOfWork = null;
let currentRoot = null;
let workInProgress = null;
let deletions = null;

let wipFiber = null;
let hookIndex = null;
let workInProgressHook = null;
let oldHook = null;

function createElement(type, props, ...children) {
  return {
    type,
    props: {
      ...props,
      children: children.map(child =>
        typeof child === "object" ? child : createTextElement(child)
      )
    }
  };
}

function createTextElement(text) {
  return {
    type: "TEXT_ELEMENT",
    props: {
      nodeValue: text,
      children: []
    }
  };
}

function createDom(fiber) {
  const dom =
    fiber.type == "TEXT_ELEMENT"
      ? document.createTextNode("")
      : document.createElement(fiber.type);

  updateDom(dom, {}, fiber.props);

  return dom;
}

const isEvent = key => key.startsWith("on");
const isProperty = key => key !== "children" && !isEvent(key);
const isNew = (prev, next) => key => prev[key] !== next[key];
const isGone = (prev, next) => key => !(key in next);
function updateDom(dom, prevProps, nextProps) {
  //Remove old or changed event listeners
  Object.keys(prevProps)
    .filter(isEvent)
    .filter(key => !(key in nextProps) || isNew(prevProps, nextProps)(key))
    .forEach(name => {
      const eventType = name.toLowerCase().substring(2);
      dom.removeEventListener(eventType, prevProps[name]);
    });

  // Remove old properties
  Object.keys(prevProps)
    .filter(isProperty)
    .filter(isGone(prevProps, nextProps))
    .forEach(name => {
      dom[name] = "";
    });

  // Set new or changed properties
  Object.keys(nextProps)
    .filter(isProperty)
    .filter(isNew(prevProps, nextProps))
    .forEach(name => {
      dom[name] = nextProps[name];
    });

  // Add event listeners
  Object.keys(nextProps)
    .filter(isEvent)
    .filter(isNew(prevProps, nextProps))
    .forEach(name => {
      const eventType = name.toLowerCase().substring(2);
      dom.addEventListener(eventType, nextProps[name]);
    });
}

function commitRoot() {
  deletions.forEach(commitWork);
  commitWork(workInProgress.child);
  currentRoot = workInProgress;
  workInProgress = null;
}
function commitWork(fiber) {
  if (!fiber) {
    return;
  }

  let domParentFiber = fiber.return;
  while (!domParentFiber.dom) {
    domParentFiber = domParentFiber.return;
  }
  const domParent = domParentFiber.dom;

  if (fiber.effectTag === "PLACEMENT" && fiber.dom != null) {
    domParent.appendChild(fiber.dom);
  } else if (fiber.effectTag === "UPDATE" && fiber.dom != null) {
    updateDom(fiber.dom, fiber.alternate.props, fiber.props);
  } else if (fiber.effectTag === "DELETION") {
    commitDeletion(fiber, domParent);
  }

  commitWork(fiber.child);
  commitWork(fiber.sibling);
}

function commitDeletion(fiber, domParent) {
  if (fiber.dom) {
    domParent.removeChild(fiber.dom);
  } else {
    commitDeletion(fiber.child, domParent);
  }
}

function render(element, container) {
  workInProgress = {
    dom: container,
    props: {
      children: [element]
    },
    alternate: currentRoot
  };
  deletions = [];
  nextUnitOfWork = workInProgress;
}

function workLoop(deadline) {
  let shouldYield = false;
  // 存在fiber并且时间空闲
  while (nextUnitOfWork && !shouldYield) {
    nextUnitOfWork = performUnitOfWork(nextUnitOfWork);
    shouldYield = deadline.timeRemaining() < 1; // 剩余时间是否小于1ms 代表任务繁忙
  }

  // 没有fiber并且wip存在
  if (!nextUnitOfWork && workInProgress) {
    commitRoot();
  }
  // 繁忙时继续执行主任务
  requestIdleCallback(workLoop);
}

requestIdleCallback(workLoop);

// https://github.com/facebook/react/blob/603e6108f39c6663ec703eed34a89ff1bf0cb70c/packages/react-reconciler/src/ReactFiberWorkLoop.js#L189
function performUnitOfWork(fiber) {
  // console.log('performUnitOfWork', fiber)
  // beginWork
  const isFunctionComponent = fiber.type instanceof Function;
  if (isFunctionComponent) {
    updateFunctionComponent(fiber);
  } else {
    updateHostComponent(fiber);
  }
  if (fiber.child) {
    return fiber.child;
  }
  let nextFiber = fiber;
  while (nextFiber) {
    if (nextFiber.sibling) {
      return nextFiber.sibling;
    }
    nextFiber = nextFiber.return;
  }
}
// beginWork
function updateFunctionComponent(fiber) {
  wipFiber = fiber;
  hookIndex = 0;
  wipFiber.memoizedState = null;
  console.log('updateFunctionComponent', wipFiber.alternate?.memoizedState)
  const children = [fiber.type(fiber.props)];
  reconcileChildren(fiber, children);



}

function useState(initial) {
  if (!oldHook) {
    oldHook = wipFiber.alternate?.memoizedState
  }

  const hook = {
    state: oldHook ? oldHook.state : initial,
    queue: [],
    next: oldHook ? oldHook.next : null,
  };
  // 
  const actions = oldHook ? oldHook.queue : [];
  actions.forEach(action => {
    hook.state = action(hook.state);
  });
  // 构建 hook 链表
  if (!workInProgressHook) {
    workInProgressHook = hook
    wipFiber.memoizedState = workInProgressHook;
  } else {
    workInProgressHook = workInProgressHook.next = hook
  }
  oldHook = oldHook && oldHook.next
  const setState = action => {
    hook.queue.push(action);
    workInProgress = {
      dom: currentRoot.dom,
      props: currentRoot.props,
      alternate: currentRoot
    };
    oldHook = null
    workInProgressHook = null
    nextUnitOfWork = workInProgress;
    deletions = [];
  };
  // console.log(123123, hook)
  // wipFiber.hooks.push(hook);
  // hookIndex++;
  return [hook.state, setState];
}

function updateHostComponent(fiber) {
  if (!fiber.dom) {

    fiber.dom = createDom(fiber);
    // console.log(13123, fiber.dom)
  }
  reconcileChildren(fiber, fiber.props.children);
}
// 调和
function reconcileChildren(wipFiber, elements) {
  // console.log('reconcileChildren', elements);
  let index = 0;
  let oldFiber = wipFiber.alternate && wipFiber.alternate.child;
  let prevSibling = null;
  while (index < elements.length || oldFiber != null) {
    const element = elements[index];
    let newFiber = null;

    const sameType = oldFiber && element && element.type == oldFiber.type;

    if (sameType) {
      newFiber = {
        type: oldFiber.type,
        props: element.props,
        dom: oldFiber.dom,
        return: wipFiber,
        alternate: oldFiber,
        effectTag: "UPDATE"
      };
    }
    if (element && !sameType) {
      newFiber = {
        type: element.type,
        props: element.props,
        dom: null,
        return: wipFiber,
        alternate: null,
        effectTag: "PLACEMENT"
      };
    }
    if (oldFiber && !sameType) {
      oldFiber.effectTag = "DELETION";
      deletions.push(oldFiber);
    }

    if (oldFiber) {
      oldFiber = oldFiber.sibling;
    }

    if (index === 0) {
      wipFiber.child = newFiber;
    } else if (element) {
      prevSibling.sibling = newFiber;
    }

    prevSibling = newFiber;
    index++;
  }
}

const MiniReact = {
  createElement,
  render,
  useState
};

/** @jsx MiniReact.createElement */
function Counter() {
  const [state, setState] = MiniReact.useState(2);
  const [state1, setState1] = MiniReact.useState(6);
  const [state4, setState4] = MiniReact.useState(7);
  return (
    <div>
      <h1 onClick={() => { setState(c => c + 1) }} style="user-select: none">
        Count: {state}
      </h1>
      <p onClick={() => { setState1(c => c + 1) }}>Count: {state1}</p>
      <p>Count: {state4}</p>
    </div>
  );
}
const element = <Counter />;
const container = document.getElementById("root");
MiniReact.render(element, container);
