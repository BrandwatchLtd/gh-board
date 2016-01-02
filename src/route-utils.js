import _ from 'underscore';
import {getReposFromStr, convertRepoInfosToStr, KANBAN_LABEL, UNCATEGORIZED_NAME} from './helpers';

const RELEVANT_PATH_SEGMENT = 2;
let ROUTER_HISTORY = null;
export function setRouterHistory(history) {
  ROUTER_HISTORY = history;
}


function toQueryString(options) {
  if (!options || options === {}) {
    return '';
  }
  let params = [];
  const ref = options || {};
  for (const key in ref) {
    let values = ref[key];
    if (!Array.isArray(values)) {
      values = [values];
    }
    values.forEach((val) => {
      params.push(`${key}=${encodeURIComponent(val)}`);
    });
  }
  if (params.length > 0) {
    return `?${params.join('&')}`;
  } else {
    return '';
  }
};

function addParams(options, key, vals) {
  const arr = options[key] || [];
  if (Array.isArray(vals)) {
    options[key] = arr.concat(vals);
  } else if (vals) {
    arr.push(vals);
    options[key] = arr;
  } else {
    // it was null, so ignore it
  }
};

// Generate a URL based on various filters and whatnot
// `/r/:repoStr(/m/:milestonesStr)(/t/:tagsStr)(/u/:user)(/x/:columnRegExp)/:name(/:startShas)(/:endShas)
export function buildRoute(name, {repoInfos, milestoneTitles, tagNames, userName, columnRegExp, routeSegmentName}={}, ...otherFields) {
  repoInfos = repoInfos || [];
  milestoneTitles = milestoneTitles || [];
  tagNames = tagNames || [];

  // when not changing the page then keep the original path segment
  // **BUT:** Allow setting '' explicitly to override this
  if (name === null) {
    name = routeSegmentName;
  }

  const repoStr = convertRepoInfosToStr(repoInfos);

  const options = {};
  addParams(options, 'm', milestoneTitles);
  addParams(options, 'l', tagNames);
  addParams(options, 'u', userName);
  if (columnRegExp) {
    const re = columnRegExp.toString();
    // Strip off the wrapping `/` marks
    addParams(options, 'x', re.substring(1, re.length-1));
  }



  const parts = [];
  if (repoStr) { parts.push(`/r/${repoStr}`); }

  if (name) { parts.push(`/${name}`); }
  otherFields.forEach((field) => {
    parts.push(`/${field}`);
  });
  return encodeURI(parts.join('')) + toQueryString(options);
}

function parseArray(x) {
  if (Array.isArray(x)) {
    return x;
  } else {
    return [x];
  }
}

export function parseRoute({params, routes, location}) {
  let {repoStr, milestonesStr, tagsStr, userName, columnRegExpStr} = params;
  // Note: routeSegmentName can be null if it's the index path (the kanban view)
  if (!routes[RELEVANT_PATH_SEGMENT]) { throw new Error('BUG! looks like you are calling parseRoute (or setFilters) outside of the "magic" route which contains all the filter criteria'); }
  const routeSegmentName = routes[RELEVANT_PATH_SEGMENT].path; // kanban is the "index" path
  if (/[:\/]/.test(routeSegmentName)) { // Check for paths containing a '/' or a ':'
    throw new Error('BUG! the path segment should be simple so we can create links with it');
  }
  let repoInfos = [];
  let milestoneTitles = [];
  let tagNames = [];
  let columnRegExp;

  // TODO: remove these fallbacks once URL's are updated.
  if (repoStr) { repoInfos = getReposFromStr(repoStr); }
  if (milestonesStr) { milestoneTitles = milestonesStr.split('|'); }
  if (tagsStr) { tagNames = tagsStr.split('|'); }
  if (columnRegExpStr) { columnRegExp = new RegExp(columnRegExpStr); }

  const {query} = location;
  if (query.m) { milestoneTitles = parseArray(query.m); }
  if (query.l) { tagNames = parseArray(query.l); }
  if (query.u) { userName = query.u; }
  if (query.x) { columnRegExp = new RegExp(query.x); }

  return {repoInfos, milestoneTitles, tagNames, userName, columnRegExp, routeSegmentName};
}

class FilterState {
  constructor(state) {
    this.state = state;
  }
  _chain(obj) {
    return new FilterState(_.defaults(obj, this.state));
  }
  _toggleKey(key, value) {
    let current = this.state[key];
    let i = current.indexOf(value);
    // if the string isn't found, try adding/removing the '-' to see if
    // there is an exclusion string that we can still remove
    // if (i < 0) {
    //   if (value[0] === '-') {
    //     i = current.indexOf(value.substring(1));
    //   } else {
    //     i = current.indexOf(`-${value}`);
    //   }
    // }

    if (i < 0) {
      current = current.concat(value);
    } else {
      current = current.slice(0, i).concat(current.slice(i+1)); // or _.without(current, value)
    }
    const obj = {};
    obj[key] = current;
    return this._chain(obj);
  }
  // addMilestone(ms)
  // removeMilestone(ms)
  toggleMilestoneTitle(title) {
    return this._toggleKey('milestoneTitles', title);
  }
  clearMilestoneTitles() {
    return this._chain({milestoneTitles: []});
  }
  // addTag(tag)
  // removeTag(tag)
  toggleTagName(tagName) {
    return this._toggleKey('tagNames', tagName);
  }
  // setUser(user)
  // clearUser()
  toggleUserName(name) {
    const {userName} = this.state;
    if (userName) {
      name = null;
    }
    return this._chain({userName: name});
  }
  // setColumnRegExp(reStr)
  setRouteName(routeSegmentName) {
    return this._chain({routeSegmentName});
  }
  go() {
    ROUTER_HISTORY.pushState(null, this.url());
  }
  url() {
    return buildRoute(null, this.state);
  }
  getState() {
    return _.defaults({}, this.state, {columnRegExp: KANBAN_LABEL});
  }
}

const DEFAULTS = {
  repoInfos: [],
  milestoneTitles: [],
  tagNames: [],
  columnRegExp: undefined
};

let FILTER_STATE = new FilterState(DEFAULTS);
// method signature is from react-router onEnter:
// https://github.com/rackt/react-router/blob/master/docs/API.md#onenternextstate-replacestate-callback
export function setFilters(routerState/*,replaceState,callback*/) {
  FILTER_STATE = new FilterState(_.defaults(parseRoute(routerState), DEFAULTS));
}

export function getFilters() {
  // TODO: inject defaults from localStorage (esp the checkboxes)
  return FILTER_STATE;
}

export const LABEL_CACHE = {}; // keys are label names and values are the label object (contains color)


function isUser(issue, userName) {
  if (issue.assignee) {
    if (issue.assignee.login !== userName) { return false; }
  }
  if (issue.user.login !== userName) { return false; }
  return true;
};


// Filters the list of cards by the criteria set in the URL.
// Used by IssueStore.fetchIssues()
export function filterCardsByFilter(cards) {
  const {milestoneTitles, userName, columnRegExp} = getFilters().getState();
  let {tagNames} = getFilters().getState(); // We might remove UNCATEGORIZED_NAME from the list
  const includedTagNames = tagNames.filter((tagName) => { return tagName[0] !== '-'; });
  const excludedTagNames = tagNames.filter((tagName) => { return tagName[0] === '-'; }).map((tagName) => { return tagName.substring(1); });

  const includedMilestoneTitles = milestoneTitles.filter((milestoneTitle) => { return milestoneTitle[0] !== '-'; });
  const excludedMilestoneTitles = milestoneTitles.filter((milestoneTitle) => { return milestoneTitle[0] === '-'; }).map((milestoneTitle) => { return milestoneTitle.substring(1); });

  return cards.filter((card) => {
    const {issue} = card;
    // Add all the labels for lookup later (like the color)
    issue.labels.forEach((label) => {
      LABEL_CACHE[label.name] = label;
    });
    // issue must match the user if one is selected (either assignee or creator (if none))
    if (userName) {
      // Support negating the username
      if (userName[0] === '-') {
        if (isUser(issue, userName.substring(1))) { return false; }
      } else {
        if (!isUser(issue, userName)) { return false; }
      }
    }
    // issue must be in one of the milestones (if milestones are selected)
    if (milestoneTitles.length > 0) {
      if (includedMilestoneTitles.length > 0) {
        if (!issue.milestone) { return false; } // TODO: Read the settings to see if no milestones are allowed
      }
      if (issue.milestone) {
        if (includedMilestoneTitles.length > 0 && includedMilestoneTitles.indexOf(issue.milestone.title) < 0) { return false; }
        if (excludedMilestoneTitles.length > 0 && excludedMilestoneTitles.indexOf(issue.milestone.title) >= 0) { return false; }
      }
    }
    // If one of the tagNames is UNCATEGORIZED_NAME then do something special
    if (tagNames.indexOf(UNCATEGORIZED_NAME) >= 0) {
      let isUnlabeled = true;
      issue.labels.forEach((label) => {
        if (columnRegExp.test(label.name)) {
          isUnlabeled = false;
        }
      });
      if (!isUnlabeled) { return false; }
    }
    const labelNames = issue.labels.map((label) => { return label.name; });
    // issue must have all the tags (except UNCATEGORIZED_NAME)
    // and MUST NOT have any of the excluded tags
    if (_.difference(_.without(includedTagNames, UNCATEGORIZED_NAME), labelNames).length > 0) { return false; }
    if (_.intersection(excludedTagNames, labelNames).length > 0) { return false; }
    return true;
  });
}
