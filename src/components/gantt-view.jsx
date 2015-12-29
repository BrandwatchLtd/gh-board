import React from 'react';
import _ from 'underscore';

import IssueStore from '../issue-store';
import Client from '../github-client';
import {getReposFromStr, getCardColumn, UNCATEGORIZED_NAME} from '../helpers';
import Loadable from './loadable';
import LabelBadge from './label-badge';

import d3 from 'd3';
import gantt from '../gantt-chart';


const filterByMilestoneAndKanbanColumn = (cards) => {
  const data = {};
  const columns = {};
  const add = (card) => {
    if (card.issue.milestone) {
      const column = getCardColumn(card);
      const columnName = column.name;
      columns[columnName] = column;
      const msCounts = data[card.issue.milestone.title] || {};
      data[card.issue.milestone.title] = msCounts;
      msCounts[columnName] = msCounts[columnName] || 0;
      msCounts[columnName] += 1;
    } else {
      // TODO: SHould account for issues not in a milestone somehow
    }
  };

  cards.forEach((card) => {
    add(card);
  })
  return {data, columns: _.values(columns)};
}


const GanttChart = React.createClass({
  componentDidMount() {
    const {milestones, data, columns} = this.props;
    const now = new Date();

    const tasks = milestones.map((milestone) => {
      const {createdAt, dueOn, title, state, closedIssues, openIssues} = milestone;
      const dueAt = dueOn ? new Date(dueOn) : null;
      let status;
      if (dueAt && dueAt.getTime() < now.getTime()) {
        status = 'milestone-status-overdue';
      } else {
        status = `milestone-status-${state}`;
      }
      let percent;
      if (closedIssues + openIssues) {
        percent = closedIssues / (closedIssues + openIssues);
      } else {
        percent = Math.random(); //TODO: HACK to just show something "interesting"
      }
      const segments = [];
      if (closedIssues) {
        segments.push({count: closedIssues, color: '#333', title: 'Closed Issues'});
      }
      _.each(columns, ({name, color}) => {
        if (data[milestone.title]) {
          const count = data[milestone.title][name] || 0;
          if (count) {
            segments.push({count, color, title:name});
          }
        }
      });
      return {
        startDate: createdAt,
        endDate: dueAt || now,
        taskName: title,
        status: status,
        segments: segments
      };
    });

    const taskStatus = {
      'milestone-status-overdue': 'milestone-status-overdue',
        'milestone-status-open' : 'milestone-status-open',
        'milestone-status-closed' : 'milestone-status-closed'
    };

    const taskNames = tasks.map(({taskName}) => taskName).sort();

    tasks.sort(function(a, b) {
        return a.endDate - b.endDate;
    });
    const maxDate = tasks[tasks.length - 1].endDate;
    tasks.sort(function(a, b) {
        return a.startDate - b.startDate;
    });
    // const minDate = tasks[0].startDate;

    const format = '%H:%M';

    const chart = gantt(taskNames.length).taskTypes(taskNames).taskStatus(taskStatus).tickFormat(format).selector('#the-gantt-chart');
    chart(tasks);


    function changeTimeDomain(timeDomainString) {
        let format;
        switch (timeDomainString) {
          case '1hr':
          	format = '%H:%M:%S';
          	chart.timeDomain([ d3.time.hour.offset(maxDate, -1), maxDate ]);
          	break;
          case '3hr':
          	format = '%H:%M';
          	chart.timeDomain([ d3.time.hour.offset(maxDate, -3), maxDate ]);
          	break;

          case '6hr':
          	format = '%H:%M';
          	chart.timeDomain([ d3.time.hour.offset(maxDate, -6), maxDate ]);
          	break;

          case '1day':
          	format = '%H:%M';
          	chart.timeDomain([ d3.time.day.offset(maxDate, -1), maxDate ]);
          	break;

          case '1week':
          	format = '%m/%d';
          	chart.timeDomain([ d3.time.day.offset(maxDate, -7), maxDate ]);
          	break;
          default:
          	format = '%H:%M';

        }
        chart.tickFormat(format);
        chart.redraw(tasks);
    }

    changeTimeDomain('1week');

  },
  render() {
    const {columns} = this.props;

    const legend = columns.map((label) => {
      return (
        <LabelBadge key={label.name} label={label}/>
      );
    });
    return (
      <div className='-gantt-chart-and-legend'>
        <div ref='ganttWrapper' id='the-gantt-chart'/>
        <h3>Legend</h3>
        <p>Blue vertical line is Today</p>
        <LabelBadge key='completed' label={{name:'0 - Completed', color: '333'}}/>
        {legend}
      </div>
    );
  }

});

const RepoKanbanShell = React.createClass({
  componentWillMount() {
    // Needs to be called before `render()`
    IssueStore.startPolling();
  },
  componentWillUnmount() {
    IssueStore.stopPolling();
  },
  renderLoaded([allMilestones, cards]) {
    let {data, columns} = filterByMilestoneAndKanbanColumn(cards);
    // COPYPASTA: Taken from repo-kanban
    columns = _.sortBy(columns, ({name}) => {
      if (name === UNCATEGORIZED_NAME) {
        // make sure Uncategorized is the left-most column
        return -1;
      } else {
        const result = /^(\d+)/.exec(name);
        return result && result[1] || name;
      }
    });
    columns = columns.reverse();

    return (
      <GanttChart milestones={allMilestones} data={data} columns={columns}/>
    );
  },
  render() {
    let {repoStr} = this.props.params;
    const repoInfos = getReposFromStr(repoStr);
    // Get the "Primary" repo for milestones and labels
    const [{repoOwner, repoName}] = repoInfos;

    // TODO: Actually do all the milestones
    const allPromises = Promise.all([Client.getOcto().repos(repoOwner, repoName).milestones.fetch(), IssueStore.fetchAllIssues(repoInfos)]);

    return (
      <Loadable
        promise={allPromises}
        renderLoaded={this.renderLoaded}
      />
    );
  }
});

export default RepoKanbanShell;
