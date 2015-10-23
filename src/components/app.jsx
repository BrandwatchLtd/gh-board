import _ from 'underscore';
import React from 'react';
import {Link, RouteHandler, HistoryLocation} from 'react-router';
import * as BS from 'react-bootstrap';
import HTML5Backend from 'react-dnd/modules/backends/HTML5';
import { DragDropContext } from 'react-dnd';

import SettingsStore from '../settings-store';
import Client from '../github-client';
import NewVersionChecker from '../new-version-checker';
import CurrentUserStore from '../user-store';
import FilterStore from '../filter-store';
import IssueStore from '../issue-store';

import LoginModal from './login-modal.jsx';
import LabelBadge from './label-badge.jsx';
import MoveModal from './move-modal.jsx';
import Time from './time.jsx';
import Loadable from './loadable.jsx';

import GameModal from './game-modal.jsx';


const KarmaWarning = React.createClass({
  getInitialState() {
    return {timer: null, limit: null, remaining: null, newestVersion: null};
  },
  componentDidMount() {
    NewVersionChecker.on('change', this.updateNewestVersion);
    Client.on('request', this.updateRateLimit);
  },
  componentWillUnmount() {
    NewVersionChecker.off('change', this.updateNewestVersion);
    Client.off('request', this.updateRateLimit);
  },
  updateRateLimit({rate: {remaining, limit, reset}} /*, method, path, data, options */) {
    this.setState({remaining, limit, reset: new Date(reset * 1000)});
  },
  updateNewestVersion(newestVersion) {
    this.setState({newestVersion});
  },
  showGameModal() {
    this.setState({isGameOpen: true});
  },
  onHideGameModal() {
    this.setState({isGameOpen: false});
  },
  render() {
    const {remaining, limit, reset, newestVersion, isGameOpen} = this.state;
    let karmaText;
    let resetText;
    if (reset) {
      resetText = (
        <span className='reset-at'>Resets <Time dateTime={reset}/></span>
      );
    }

    let isKarmaLow = true;
    if (limit) {
      if (remaining / limit < .2) {
        karmaText = (
          <BS.Button bsStyle='danger' bsSize='sm'>{remaining} / {limit}. Sign In to avoid this. {resetText}</BS.Button>
        );
        resetText = null;
      } else {
        isKarmaLow = false;
        const percent = Math.floor(remaining * 1000 / limit) / 10;
        let bsStyle = 'danger';
        if (percent >= 75) { bsStyle = 'success'; }
        else if (percent >= 40) { bsStyle = 'warning'; }
        karmaText = (
          <BS.ProgressBar
            className='karma-progress'
            title={'Rate Limit for the GitHub API (' + remaining + '/' + limit + ')'}
            now={remaining}
            max={limit}
            bsStyle={bsStyle}
            label={percent + '% (' + remaining + ')'} />
        );
      }
    }

    let newestText = null;
    if (newestVersion) {
      newestText = (
        <button className='btn btn-primary' onClick={() => window.location.reload(true)}>New Version released <Time dateTime={new Date(newestVersion.date)}/>. Click to Reload</button>
      );
    }
    return (
      <BS.Navbar fixedBottom className='bottombar-nav'>
        <BS.Nav>
          <li>
            <span className={'karma-stats' + (isKarmaLow && ' is-karma-low' || '')}>
              <i className='octicon octicon-cloud-download' title='GitHub API'/>
              {' API Requests Left: '}
              {karmaText}
              {resetText}
            </span>
          </li>
          {newestText}
        </BS.Nav>
        <BS.Nav right>
          <BS.NavItem className='nav-squirrel' onClick={this.showGameModal}><i className='octicon octicon-gift' title='Oooh, a present!'/></BS.NavItem>
          <BS.NavItem target='_blank' href='https://github.com/philschatz/gh-board'><i className='octicon octicon-mark-github'/> Source Code</BS.NavItem>
        </BS.Nav>
        <GameModal show={isGameOpen} onHide={this.onHideGameModal}/>
      </BS.Navbar>
    );
  }
});


const SettingsItem = React.createClass({
  render() {
    const {onSelect, isChecked, children} = this.props;

    return (
      <BS.MenuItem onSelect={onSelect}>
        <span className='settings-item-checkbox' data-checked={isChecked}>{children}</span></BS.MenuItem>
    );
  }
});

const MilestonesDropdown = React.createClass({
  contextTypes: {
    router: React.PropTypes.func
  },
  componentDidMount() {
    FilterStore.on('change:milestone', this.update);
  },
  componentWillUnmount() {
    FilterStore.off('change:milestone', this.update);
  },
  update() {
    this.forceUpdate();
  },
  onSelectMilestone(milestone) {
    return () => {
      FilterStore.setMilestone(milestone);
    };
  },
  onSelectMilestonePlanning() {
    const {router} = this.context;
    router.transitionTo('viewMilestones', router.getCurrentParams());
  },
  render() {
    const {milestones} = this.props;
    const selectedMilestone = FilterStore.getMilestone();

    const renderMilestone = (milestone) => {
      let dueDate;
      if (milestone.dueOn) {
        dueDate = (
          <span className='due-at'>
            {' due '}
            <Time dateTime={new Date(milestone.dueOn)}/>
          </span>
        );
      }
      return [
        <i className='milestone-icon octicon octicon-milestone'/>,
        <span className='milestone-title'>{milestone.title}</span>,
        dueDate
      ];
    };

    if (milestones.length) {
      const milestonesItems = _.map(milestones, (milestone) => {
        return (
          <BS.MenuItem key={milestone.id} className='milestone-item' onSelect={this.onSelectMilestone(milestone)}>{renderMilestone(milestone)}</BS.MenuItem>
        );
      });
      let selectedMilestoneItem;
      if (selectedMilestone) {
        selectedMilestoneItem = renderMilestone(selectedMilestone);
      } else {
        selectedMilestoneItem = 'All Issues and Pull Requests';
      }
      return (
        <BS.NavDropdown id='milestone-dropdown' className='milestone-dropdown' title={<span className='selected-milestone'>{selectedMilestoneItem}</span>}>
          <BS.MenuItem key='1' header>Filter by Milestone</BS.MenuItem>
          {milestonesItems}
          <BS.MenuItem key='2' divider/>
          <BS.MenuItem key='3' onSelect={this.onSelectMilestone(null)}>All Issues and Pull Requests</BS.MenuItem>
          <BS.MenuItem key='4' disabled>Not in a Milestone</BS.MenuItem>
          <BS.MenuItem key='5' divider/>
          <BS.MenuItem key='6' onSelect={this.onSelectMilestonePlanning}>Milestone Planning View</BS.MenuItem>
        </BS.NavDropdown>
      );
    } else {
      return null;
    }

  }
});

const MilestonesDropdownShell = React.createClass({
  render() {
    const {repoOwner, repoName} = this.props;
    return (
      <Loadable
        promise={IssueStore.fetchMilestones(repoOwner, repoName)}
        renderLoaded={(milestones) => <MilestonesDropdown milestones={milestones}/>}
        />
    );
  }
});

const AppNav = React.createClass({
  contextTypes: {
    router: React.PropTypes.func
  },
  getInitialState() {
    return {info: null, showModal: false};
  },
  componentDidMount() {
    FilterStore.on('change', this.update);
    SettingsStore.on('change', this.update);
    SettingsStore.on('change:showPullRequestData', this.update);
    SettingsStore.on('change:tableLayout', this.update);
    Client.on('changeToken', this.onChangeToken);
    this.onChangeToken();
  },
  componentWillUnmount() {
    FilterStore.off('change', this.update);
    SettingsStore.off('change', this.update);
    SettingsStore.off('change:showPullRequestData', this.update);
    SettingsStore.off('change:tableLayout', this.update);
    Client.off('changeToken', this.onChangeToken);
  },
  update() {
    this.setState({});
  },
  onChangeToken() {
    CurrentUserStore.fetchUser()
    .then((info) => {
      // TODO: when anonymous, getting the current user should be an error.
      // probably a bug in CurrentUserStore
      if (info) {
        SettingsStore.setShowPullRequestData();
      }
      this.setState({info});
    }).catch(() => {
      this.setState({info: null});
    });
  },
  onSignOut() {
    Client.setToken(null);
    CurrentUserStore.clear();
  },
  starThisProject() {
    Client.getOcto().user.starred('philschatz/gh-board').add().then(() => {
      /*eslint-disable no-alert */
      alert('Thanks for starring!\n I hope you enjoy the other pages more than this simple alert, but thank you for helping me out!');
      /*eslint-enable no-alert */
    });
  },
  render() {
    let {repoOwner, repoNames} = this.context.router.getCurrentParams();
    if (repoNames) {
      repoNames = repoNames.split('|');
    }

    const {info, showModal} = this.state;
    const close = () => this.setState({ showModal: false});

    const brand = (
      <Link to='viewDashboard'><i className='octicon octicon-home'/></Link>
    );
    const filtering = _.map(FilterStore.getLabels(), (label) => {
      return (
        <LabelBadge label={label} onClick={() => FilterStore.removeLabel(label)}/>
      );
    });

    const filterUser = FilterStore.getUser();
    if (filterUser) {
      filtering.push(
        <BS.Badge key='user' onClick={() => FilterStore.clearUser()}>{filterUser.login}</BS.Badge>
      );
    }

    let loginButton;
    if (info) {
      const avatarImage = (
        <img
          alt={'@' + info.login}
          className='avatar-image'
          src={info.avatar.url}/>
      );
      loginButton = (
        <BS.NavDropdown id='signin-dropdown' title={avatarImage}>
          <BS.MenuItem header>Signed in as <strong>{info.login}</strong></BS.MenuItem>
          <BS.MenuItem onSelect={this.starThisProject}>Click to <i className='octicon octicon-star icon-spin' style={{color: '#fbca04'}}/> the <strong>gh-board</strong> repo if you like this project</BS.MenuItem>
          <BS.MenuItem divider/>
          <BS.MenuItem eventKey='1'><span onClick={this.onSignOut}>Sign Out</span></BS.MenuItem>
        </BS.NavDropdown>
      );
    } else {
      loginButton = (
        <BS.NavItem className='sign-in' onClick={() => this.setState({showModal: true})}>Sign In</BS.NavItem>
      );
    }

    const settingsTitle = (
      <i className='octicon octicon-gear'/>
    );

    let repoInfo = null;
    let milestonesDropdown = null;
    if (!filtering.length && repoOwner) {
      let repoNameItems;
      if (repoNames.length === 1) {
        repoNameItems = (
          <span className='repo-name'>{repoNames[0]}</span>
        );
      } else {
        repoNameItems = _.map(repoNames, (repoName, index) => {
          return (
            <span className='repo-name-wrap'>
              {index !== 0 && '&' || null}{/* Put an & between repo names */}
              <Link className='repo-name' to='viewBoard' params={{repoOwner, repoNames: repoName}}>{repoName}</Link>
            </span>
          );
        });
      }
      repoInfo = (
        <li className='repo-links'>
          <span className='repo-owner'>{repoOwner}</span>
          {'/'}
          {repoNameItems}
        </li>
      );
      milestonesDropdown = (
        <MilestonesDropdownShell repoOwner={repoOwner} repoName={repoNames[0]}/>
      );
    }

    const settingsMenuHelp = () => {
      /*eslint-disable no-alert */
      alert('When an Issue and Pull Request are linked (by writing "fixes #123" in the Pull Request description) the related Issue/Pull request is removed from the list.\n Developers will probably want to see the Pull Request in their board (since they created it) while QA would probably rather see the Issue (since they created it).');
      /*eslint-enable no-alert */
    };

    return (
      <div className='app-nav'>
        <BS.Navbar className='topbar-nav' fixedTop brand={brand}>
          <BS.Nav>
            {repoInfo}
            <BS.NavItem className='active-filter'>
              {filtering}
            </BS.NavItem>
          </BS.Nav>
          <BS.Nav right>
            {milestonesDropdown}
            <BS.NavDropdown id='display-settings' title={settingsTitle}>
              <BS.MenuItem header>Display Settings</BS.MenuItem>
              <SettingsItem
                key='HideUncategorized'
                onSelect={SettingsStore.toggleHideUncategorized.bind(SettingsStore)}
                isChecked={SettingsStore.getHideUncategorized()}
                >
                Hide Uncategorized
              </SettingsItem>
              <SettingsItem
                key='ShowEmptyColumns'
                onSelect={SettingsStore.toggleShowEmptyColumns.bind(SettingsStore)}
                isChecked={SettingsStore.getShowEmptyColumns()}
                >
                Show Empty Columns
              </SettingsItem>
              <SettingsItem
                key='TableLayout'
                onSelect={SettingsStore.toggleTableLayout.bind(SettingsStore)}
                isChecked={SettingsStore.getTableLayout()}
                >
                Use Table Layout
              </SettingsItem>
              <BS.MenuItem divider/>
              <BS.MenuItem header>Viewing Mode
                <button
                  className='btn btn-xs btn-default'
                  onClick={settingsMenuHelp}
                  >
                  <i className='octicon octicon-question'/>
                </button>
              </BS.MenuItem>
              <SettingsItem
                key='RelatedHideIssues'
                onSelect={SettingsStore.setRelatedHideIssues.bind(SettingsStore)}
                isChecked={SettingsStore.getRelatedHideIssues()}
                >
                Developer-Friendly
              </SettingsItem>
              <SettingsItem
                key='RelatedHidePullRequests'
                onSelect={SettingsStore.setRelatedHidePullRequests.bind(SettingsStore)}
                isChecked={SettingsStore.getRelatedHidePullRequests()}
                >
                QA-Friendly
              </SettingsItem>
              <SettingsItem
                key='RelatedShowAll'
                onSelect={SettingsStore.setRelatedShowAll.bind(SettingsStore)}
                isChecked={SettingsStore.getRelatedShowAll()}
                >
                Combined
              </SettingsItem>
              <BS.MenuItem>
                <Link to='viewBoardByUser' params={{repoOwner, repoNames: repoNames.join('|')}}>Manager (Issues by User)</Link>
              </BS.MenuItem>
              <BS.MenuItem divider/>
              <BS.MenuItem header>GitHub API Settings</BS.MenuItem>
              <SettingsItem
                key='ShowPullRequestData'
                onSelect={SettingsStore.toggleShowPullRequestData.bind(SettingsStore)}
                isChecked={SettingsStore.getShowPullRequestData()}
                >
                Show More Pull Request Info
              </SettingsItem>
            </BS.NavDropdown>
            {loginButton}
          </BS.Nav>
        </BS.Navbar>
        <LoginModal show={showModal} container={this} onHide={close}/>
        <MoveModal container={this}/>
      </div>
    );
  }


});

const App = React.createClass({
  contextTypes: {router: React.PropTypes.func},

  componentDidMount() {
    SettingsStore.on('change:tableLayout', this.onChange);
    HistoryLocation.addChangeListener(this.storeHistory);
    this.storeHistory({path: this.context.router.getCurrentPath()});
  },
  componentWillMount() {
    SettingsStore.off('change:tableLayout', this.onChange);
  },
  componentWillUnmount() {
    HistoryLocation.removeChangeListener(this.storeHistory);
  },
  storeHistory(locationChangeEvent) {
    if (window.ga) {
      window.ga('set', 'page', locationChangeEvent.path);
      window.ga('send', 'pageview');
    }
  },
  onChange() {
    this.forceUpdate();
  },
  render() {
    const classes = ['app'];
    if (SettingsStore.getTableLayout()) {
      classes.push('is-table-layout');
    }

    return (
      <div className={classes.join(' ')}>
        <AppNav/>
        {/* Subroutes are added here */}
        <RouteHandler/>
        <KarmaWarning/>
      </div>
    );
  }
});

export default DragDropContext(HTML5Backend)(App);
